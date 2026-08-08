import { count, desc, eq, and } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  cfAttendanceSessions,
  cfAttendanceRecords,
  cfCareCases,
  cfChurchEvents,
  cfFinanceTransactions,
  cfMembers,
} from "../../../db/schema-platform";
import { withTenantContext } from "../_tenant";
import { apiJson } from "../_security";
import type { PlatformUser } from "../../lib/auth-platform";

export async function GET(request: Request) {
  return withTenantContext(
    request,
    async (user, tenantId, requestId) => {
      const db = await getDb();

      // Membership
      const memberRows = await db
        .select({
          status: cfMembers.status,
          group: cfMembers.groupName,
          joinedAt: cfMembers.joinedAt,
          birthDate: cfMembers.birthDate,
          phone: cfMembers.phone,
          email: cfMembers.email,
        })
        .from(cfMembers)
        .where(eq(cfMembers.tenantId, tenantId));

      // Attendance
      const sessions = await db
        .select()
        .from(cfAttendanceSessions)
        .where(eq(cfAttendanceSessions.tenantId, tenantId))
        .orderBy(desc(cfAttendanceSessions.serviceDate))
        .limit(12);

      const attendanceRows = await db
        .select({
          sessionId: cfAttendanceRecords.sessionId,
          personType: cfAttendanceRecords.personType,
        })
        .from(cfAttendanceRecords)
        .where(
          eq(cfAttendanceRecords.tenantId, tenantId)
        );

      // Events
      const eventRows = await db
        .select({ status: cfChurchEvents.status })
        .from(cfChurchEvents)
        .where(eq(cfChurchEvents.tenantId, tenantId));

      // Care
      const [openCare] = await db
        .select({ value: count() })
        .from(cfCareCases)
        .where(
          and(
            eq(cfCareCases.tenantId, tenantId),
            eq(cfCareCases.status, "Open")
          )
        );

      const sessionSummary = sessions.map((session) => ({
        id: session.id,
        title: session.title,
        date: session.serviceDate,
        total: attendanceRows.filter(
          (record) => record.sessionId === session.id
        ).length,
        expected: session.expectedCount,
      }));

      const completedSessions = sessionSummary.filter(
        (session) => session.total > 0
      );
      const attendanceAverage = completedSessions.length
        ? Math.round(
            completedSessions.reduce(
              (sum, session) => sum + session.total,
              0
            ) / completedSessions.length
          )
        : 0;

      // Finance (only if user has permission)
      let finance: null | {
        income: number;
        expenses: number;
        balance: number;
        pending: number;
      } = null;
      if (user.role === "owner" || user.role === "tenant_admin" || user.role === "admin") {
        const rows = await db
          .select()
          .from(cfFinanceTransactions)
          .where(
            eq(cfFinanceTransactions.tenantId, tenantId)
          );
        const approved = rows.filter(
          (row) => row.status === "Approved"
        );
        const income =
          approved
            .filter((row) => row.type === "Income")
            .reduce(
              (sum, row) => sum + row.amountPesewas,
              0
            ) / 100;
        const expenses =
          approved
            .filter((row) => row.type === "Expense")
            .reduce(
              (sum, row) => sum + row.amountPesewas,
              0
            ) / 100;
        finance = {
          income,
          expenses,
          balance: income - expenses,
          pending: rows.filter(
            (row) => row.status === "Pending"
          ).length,
        };
      }

      const groupCounts = Object.entries(
        memberRows.reduce<Record<string, number>>(
          (result, member) => {
            result[member.group] =
              (result[member.group] || 0) + 1;
            return result;
          },
          {}
        )
      )
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const monthlyGrowth = Object.entries(
        memberRows.reduce<Record<string, number>>(
          (result, member) => {
            const month = /^\d{4}-\d{2}/.test(
              member.joinedAt
            )
              ? member.joinedAt.slice(0, 7)
              : "Earlier";
            result[month] =
              (result[month] || 0) + 1;
            return result;
          },
          {}
        )
      )
        .map(([month, value]) => ({ month, value }))
        .sort((a, b) =>
          a.month.localeCompare(b.month)
        )
        .slice(-12);

      const completeProfiles = memberRows.filter(
        (member) =>
          member.birthDate &&
          member.phone &&
          member.email
      ).length;

      return apiJson(
        {
          generatedAt: new Date().toISOString(),
          membership: {
            total: memberRows.length,
            active: memberRows.filter(
              (m) => m.status === "Active"
            ).length,
            newConverts: memberRows.filter(
              (m) => m.status === "New convert"
            ).length,
            followUp: memberRows.filter(
              (m) => m.status === "Follow-up"
            ).length,
            groups: groupCounts,
            monthlyGrowth,
            profileCompleteness: memberRows.length
              ? Math.round(
                  (completeProfiles /
                    memberRows.length) *
                    100
                )
              : 0,
          },
          attendance: {
            average: attendanceAverage,
            sessions: sessionSummary,
          },
          events: {
            total: eventRows.length,
            planning: eventRows.filter(
              (e) => e.status === "Planning"
            ).length,
            ready: eventRows.filter(
              (e) => e.status === "Ready"
            ).length,
            completed: eventRows.filter(
              (e) => e.status === "Completed"
            ).length,
          },
          care: { open: openCare.value },
          finance,
          exportAllowed:
            user.role === "owner" ||
            user.role === "tenant_admin",
        },
        200,
        requestId
      );
    },
    { permission: "reports:read" }
  );
}
