import { count, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { attendanceRecords, attendanceSessions, careCases, churchEvents, financeTransactions, members } from "../../../db/schema";
import { hasPermission } from "../../../lib/access";
import { requirePermission } from "../_access";
import { apiJson, safeApi } from "../_security";

export async function GET(request: Request) {
  return safeApi(request, "Unable to generate reports", async (requestId) => {
    const access = await requirePermission(request, "reports.read");
    if (access.response) return access.response;
    const db = await getDb();
    const memberRows = await db.select({ status: members.status, group: members.groupName, joinedAt: members.joinedAt, birthDate: members.birthDate, phone: members.phone, email: members.email }).from(members);
    const sessions = await db.select().from(attendanceSessions).orderBy(desc(attendanceSessions.serviceDate)).limit(12);
    const attendanceRows = await db.select({ sessionId: attendanceRecords.sessionId, personType: attendanceRecords.personType }).from(attendanceRecords);
    const eventRows = await db.select({ status: churchEvents.status }).from(churchEvents);
    const [openCare] = await db.select({ value: count() }).from(careCases).where(eq(careCases.status, "Open"));

    const sessionSummary = sessions.map((session) => ({
      id: session.id,
      title: session.title,
      date: session.serviceDate,
      total: attendanceRows.filter((record) => record.sessionId === session.id).length,
      expected: session.expectedCount,
    }));
    const completedSessions = sessionSummary.filter((session) => session.total > 0);
    const attendanceAverage = completedSessions.length
      ? Math.round(completedSessions.reduce((sum, session) => sum + session.total, 0) / completedSessions.length)
      : 0;

    let finance: null | { income: number; expenses: number; balance: number; pending: number } = null;
    if (hasPermission(access.user!.role, "finance.read")) {
      const rows = await db.select().from(financeTransactions);
      const approved = rows.filter((row) => row.status === "Approved");
      const income = approved.filter((row) => row.type === "Income").reduce((sum, row) => sum + row.amountPesewas, 0) / 100;
      const expenses = approved.filter((row) => row.type === "Expense").reduce((sum, row) => sum + row.amountPesewas, 0) / 100;
      finance = { income, expenses, balance: income - expenses, pending: rows.filter((row) => row.status === "Pending").length };
    }

    const groupCounts = Object.entries(memberRows.reduce<Record<string, number>>((result, member) => {
      result[member.group] = (result[member.group] || 0) + 1;
      return result;
    }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const monthlyGrowth = Object.entries(memberRows.reduce<Record<string, number>>((result, member) => {
      const month = /^\d{4}-\d{2}/.test(member.joinedAt) ? member.joinedAt.slice(0, 7) : "Earlier";
      result[month] = (result[month] || 0) + 1;
      return result;
    }, {})).map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
    const completeProfiles = memberRows.filter((member) => member.birthDate && member.phone && member.email).length;

    return apiJson({
      generatedAt: new Date().toISOString(),
      membership: {
        total: memberRows.length,
        active: memberRows.filter((member) => member.status === "Active").length,
        newConverts: memberRows.filter((member) => member.status === "New convert").length,
        followUp: memberRows.filter((member) => member.status === "Follow-up").length,
        groups: groupCounts,
        monthlyGrowth,
        profileCompleteness: memberRows.length ? Math.round((completeProfiles / memberRows.length) * 100) : 0,
      },
      attendance: { average: attendanceAverage, sessions: sessionSummary },
      events: {
        total: eventRows.length,
        planning: eventRows.filter((event) => event.status === "Planning").length,
        ready: eventRows.filter((event) => event.status === "Ready").length,
        completed: eventRows.filter((event) => event.status === "Completed").length,
      },
      care: { open: openCare.value },
      finance,
      exportAllowed: hasPermission(access.user!.role, "reports.export"),
    }, 200, requestId);
  });
}
