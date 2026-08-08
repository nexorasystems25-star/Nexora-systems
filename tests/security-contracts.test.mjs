import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("finance permissions separate recording from approval", async () => {
  const access = await readFile(new URL("../lib/access.ts", import.meta.url), "utf8");
  assert.match(access, /finance\.create/);
  assert.match(access, /finance\.approve/);
  assert.match(access, /finance\.reverse/);
  const officer = access.match(/finance_officer:[\s\S]*?permissions: \[([^\]]+)\]/)?.[1] ?? "";
  assert.match(officer, /finance\.create/);
  assert.doesNotMatch(officer, /finance\.approve/);
});

test("finance decisions are maker-checker, conditional and audited", async () => {
  const route = await readFile(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  assert.match(route, /recordedByUserId === access\.user!\.id/);
  assert.match(route, /eq\(financeTransactions\.status, "Pending"\)/);
  assert.match(route, /finance\.transaction\.\$\{status\.toLowerCase\(\)\}/);
  assert.match(route, /finance\.reversal\.requested/);
  assert.match(route, /reversal already exists/i);
});

test("shared API security applies no-store, request IDs and write-origin checks", async () => {
  const security = await readFile(new URL("../app/api/_security.ts", import.meta.url), "utf8");
  assert.match(security, /cache-control": "no-store"/);
  assert.match(security, /x-request-id/);
  assert.match(security, /sec-fetch-site/);
  assert.match(security, /MAX_JSON_BYTES/);
  assert.match(security, /invalid JSON/);
});

test("latest migration persists stable actors, reversals and request IDs", async () => {
  const migration = await readFile(new URL("../drizzle/0008_handy_human_cannonball.sql", import.meta.url), "utf8");
  for (const column of ["recorded_by_user_id", "approved_by_user_id", "reversal_of_id", "immutable_at", "request_id"]) {
    assert.match(migration, new RegExp(column));
  }
});

test("confidential care cases are omitted and protected from mutation", async () => {
  const care = await readFile(new URL("../app/api/care/route.ts", import.meta.url), "utf8");
  assert.match(care, /rows\.filter\(\(row\) => !row\.isConfidential\)/);
  assert.match(care, /careCase\.isConfidential && !confidentialAccess/);
  assert.match(care, /care\.confidential\.list\.viewed/);
  assert.match(care, /await readJson/);
  assert.doesNotMatch(care, /error instanceof Error \? error\.message/);
});

test("administrator changes protect the current and last super administrator", async () => {
  const users = await readFile(new URL("../app/api/users/route.ts", import.meta.url), "utf8");
  assert.match(users, /cannot remove your own administrator access/);
  assert.match(users, /At least one active super administrator is required/);
  assert.match(users, /administration\.user\.created/);
  assert.match(users, /administration\.user\.updated/);
  assert.match(users, /await readJson/);
});

test("operational write routes use guarded JSON and audit mutations", async () => {
  const routes = [
    ["attendance", "attendance.session.created"],
    ["events", "event.created"],
    ["households", "household.created"],
    ["organisation-units", "organisation_unit.created"],
  ];
  for (const [routeName, auditAction] of routes) {
    const source = await readFile(new URL(`../app/api/${routeName}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /await readJson/);
    assert.match(source, /safeApi/);
    assert.match(source, new RegExp(auditAction.replaceAll(".", "\\.")));
    assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
  }
});

test("member writes protect multipart uploads and create audit records", async () => {
  const members = await readFile(new URL("../app/api/members/route.ts", import.meta.url), "utf8");
  assert.match(members, /assertSameOriginWrite/);
  assert.match(members, /6 \* 1024 \* 1024/);
  assert.match(members, /5 \* 1024 \* 1024/);
  assert.match(members, /member\.created/);
  assert.match(members, /member\.updated/);
  assert.doesNotMatch(members, /error instanceof Error \? error\.message/);
});

test("administrators have a protected audit feed and authenticated health check", async () => {
  const audit = await readFile(new URL("../app/api/audit/route.ts", import.meta.url), "utf8");
  const health = await readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(audit, /administration\.manage/);
  assert.match(audit, /limit\(100\)/);
  assert.doesNotMatch(audit, /auditLogs\.detail/);
  assert.match(health, /dashboard\.read/);
  assert.match(health, /database: "available"/);
});

test("communication campaigns are persistent, permission-controlled and never imply immediate sending", async () => {
  const route = await readFile(new URL("../app/api/communication/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0009_flashy_edwin_jarvis.sql", import.meta.url), "utf8");
  assert.match(route, /communication\.manage/);
  assert.match(route, /communication\.campaign\.created/);
  assert.match(route, /Choose a future delivery time/);
  assert.match(route, /Sent campaign logs are immutable/);
  assert.match(migration, /communication_campaigns/);
});

test("reports protect finance aggregates and exclude confidential care detail", async () => {
  const route = await readFile(new URL("../app/api/reports/route.ts", import.meta.url), "utf8");
  assert.match(route, /reports\.read/);
  assert.match(route, /hasPermission\(access\.user!\.role, "finance\.read"\)/);
  assert.match(route, /exportAllowed/);
  assert.doesNotMatch(route, /sensitiveNotes|personPhone|summary/);
});

test("leadership appointments remain separate from system access", async () => {
  const route = await readFile(new URL("../app/api/leadership/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0010_flowery_justin_hammer.sql", import.meta.url), "utf8");
  assert.match(route, /leadership\.manage/);
  assert.match(route, /leadership\.appointment\.created/);
  assert.match(route, /memberChurchId/);
  assert.doesNotMatch(route, /users\)\.values|rolePolicies/);
  assert.match(migration, /leadership_appointments/);
});

test("volunteer assignments require active profiles and are audited", async () => {
  const route = await readFile(new URL("../app/api/volunteers/route.ts", import.meta.url), "utf8");
  assert.match(route, /Only active volunteers can be scheduled/);
  assert.match(route, /volunteer\.assignment\.created/);
  assert.match(route, /volunteer\.profile\.created/);
  assert.match(route, /volunteers\.manage/);
});

test("welfare finance protects privacy and uses two-stage ledger approval", async () => {
  const route = await readFile(new URL("../app/api/welfare-finance/route.ts", import.meta.url), "utf8");
  const access = await readFile(new URL("../lib/access.ts", import.meta.url), "utf8");
  assert.match(access, /welfare\.manage/);
  assert.match(access, /welfare\.approve/);
  assert.match(route, /record\.requestedByUserId === access\.user!\.id/);
  assert.match(route, /eq\(welfareRequests\.status, "Pending assessment"\)/);
  assert.match(route, /category: "Welfare Support"/);
  assert.match(route, /status: "Pending"/);
  assert.doesNotMatch(route, /sensitiveNotes/);
});

test("payroll masks accounts and separates preparation, approval and payment", async () => {
  const route = await readFile(new URL("../app/api/payroll/route.ts", import.meta.url), "utf8");
  const access = await readFile(new URL("../lib/access.ts", import.meta.url), "utf8");
  assert.match(access, /payroll\.manage/);
  assert.match(access, /payroll\.approve/);
  assert.match(route, /run\.preparedByUserId === access\.user!\.id/);
  assert.match(route, /eq\(payrollRuns\.status, "Pending"\)/);
  assert.match(route, /bankAccountLast4 \? `••••/);
  assert.match(route, /category: "Payroll"/);
  assert.match(route, /status: "Pending"/);
});

test("welfare and payroll persist exact pesewa values and ledger links", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0011_friendly_jackpot.sql", import.meta.url), "utf8");
  assert.match(schema, /amountRequestedPesewas/);
  assert.match(schema, /baseSalaryPesewas/);
  assert.match(schema, /financeTransactionId/);
  assert.match(migration, /welfare_requests/);
  assert.match(migration, /payroll_runs/);
  assert.match(migration, /payroll_items/);
});

test("official records use governed templates and immutable issue workflow", async () => {
  const route = await readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8");
  const access = await readFile(new URL("../lib/access.ts", import.meta.url), "utf8");
  assert.match(access, /records\.manage/);
  assert.match(access, /records\.issue/);
  assert.match(route, /TEMPLATES\.includes/);
  assert.match(route, /record\.status === "Issued"/);
  assert.match(route, /record\.issued/);
  assert.match(route, /issuedByUserId/);
});

test("archive uploads are bounded, allowlisted and never expose object keys", async () => {
  const route = await readFile(new URL("../app/api/archive/route.ts", import.meta.url), "utf8");
  assert.match(route, /assertSameOriginWrite/);
  assert.match(route, /assertBodySize\(request, 26 \* 1024 \* 1024\)/);
  assert.match(route, /ALLOWED\.includes\(file\.type\)/);
  assert.match(route, /file && externalUrl/);
  assert.match(route, /crypto\.randomUUID/);
  assert.doesNotMatch(route, /fileKey: asset\.fileKey/);
  assert.match(route, /archive\.asset\.created/);
});

test("archive downloads authorise before storage and force private safe delivery", async () => {
  const route = await readFile(new URL("../app/api/archive-file/route.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("requirePermission") < route.indexOf("env.BUCKET.get"));
  assert.match(route, /archive\.asset\.downloaded/);
  assert.match(route, /private, no-store/);
  assert.match(route, /x-content-type-options/);
  assert.match(route, /content-disposition/);
});

test("records and archive migration persists stable metadata", async () => {
  const migration = await readFile(new URL("../drizzle/0012_worthless_joshua_kane.sql", import.meta.url), "utf8");
  assert.match(migration, /generated_records/);
  assert.match(migration, /archive_assets/);
  assert.match(migration, /record_code/);
  assert.match(migration, /asset_code/);
});

test("member bulk import validates before bounded audited writes", async () => {
  const route = await readFile(new URL("../app/api/members-import/route.ts", import.meta.url), "utf8");
  assert.match(route, /requirePermission\(request, "members\.import"\)/);
  assert.match(route, /assertBodySize\(request, 1024 \* 1024\)/);
  assert.match(route, /maximum of 500 members/i);
  assert.match(route, /dryRun/);
  assert.match(route, /duplicate church IDs/);
  assert.match(route, /members\.bulk_imported/);
});

test("celebration reminders are idempotent and create drafts rather than sends", async () => {
  const route = await readFile(new URL("../app/api/reminders/route.ts", import.meta.url), "utf8");
  assert.match(route, /requirePermission\(request, "reminders\.manage"\)/);
  assert.match(route, /nextOccurrence/);
  assert.match(route, /daysUntil <= 45/);
  assert.match(route, /status: "Draft"/);
  assert.match(route, /reminder\.prepared/);
  assert.doesNotMatch(route, /status: "Sent"/);
});

test("celebration reminders persist unique occurrences and wedding dates", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0013_colorful_unicorn.sql", import.meta.url), "utf8");
  assert.match(schema, /weddingDate/);
  assert.match(schema, /celebration_member_occurrence_unique/);
  assert.match(migration, /celebration_reminders/);
  assert.match(migration, /wedding_date/);
});

test("advanced reports include growth and profile quality without confidential details", async () => {
  const route = await readFile(new URL("../app/api/reports/route.ts", import.meta.url), "utf8");
  assert.match(route, /monthlyGrowth/);
  assert.match(route, /profileCompleteness/);
  assert.doesNotMatch(route, /sensitiveNotes/);
});

test("mobile access stores token hashes and preserves server-side role enforcement", async () => {
  const access = await readFile(new URL("../app/api/_access.ts", import.meta.url), "utf8");
  assert.match(access, /authorization\?\.startsWith\("Bearer cfm_"\)/);
  assert.match(access, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(access, /eq\(mobileDevices\.tokenHash, tokenHash\)/);
  assert.match(access, /device\.status !== "Active"/);
  assert.match(access, /Date\.parse\(device\.expiresAt\) <= Date\.now\(\)/);
  assert.match(access, /mobileUser\.status !== "Active"/);
  assert.match(access, /rolePolicies\[role\]\.permissions/);
});

test("mobile activation is administrator-controlled, revocable and audited", async () => {
  const route = await readFile(new URL("../app/api/mobile-access/route.ts", import.meta.url), "utf8");
  assert.match(route, /requirePermission\(request, "administration\.manage"\)/);
  assert.match(route, /tokenHash: await hashToken\(token\)/);
  assert.match(route, /status: "Revoked"/);
  assert.match(route, /mobile\.access\.issued/);
  assert.match(route, /mobile\.access\.revoked/);
  assert.doesNotMatch(route, /tokenHash: mobileDevices\.tokenHash/);
});

test("mobile client secures activation and only caches read fallbacks", async () => {
  const api = await readFile(new URL("../mobile/src/api.ts", import.meta.url), "utf8");
  const app = await readFile(new URL("../mobile/App.tsx", import.meta.url), "utf8");
  assert.match(api, /SecureStore\.setItemAsync/);
  assert.match(api, /authorization: `Bearer \$\{token\}`/);
  assert.match(api, /AsyncStorage\.setItem/);
  assert.match(app, /checkInMethod:"Mobile"/);
  assert.match(app, /api<\{session:Attendance\}>\("\/api\/attendance",\{method:"POST"/);
  assert.doesNotMatch(app, /AsyncStorage/);
});

test("mobile device migration persists only hashed, expiring credentials", async () => {
  const migration = await readFile(new URL("../drizzle/0014_previous_thor_girl.sql", import.meta.url), "utf8");
  assert.match(migration, /mobile_devices/);
  assert.match(migration, /token_hash/);
  assert.match(migration, /expires_at/);
  assert.match(migration, /revoked_at/);
  assert.doesNotMatch(migration, /activation_token|raw_token/);
});

test("member portal access is linked, least-privilege and administrator-created", async () => {
  const access = await readFile(new URL("../lib/access.ts", import.meta.url), "utf8");
  const users = await readFile(new URL("../app/api/users/route.ts", import.meta.url), "utf8");
  assert.match(access, /member:[\s\S]*?permissions: \["portal\.read", "portal\.profile\.update"\]/);
  assert.doesNotMatch(access.match(/member:[\s\S]*?permissions: \[([^\]]+)\]/)?.[1] ?? "", /members\.read|finance\.read|administration\.manage/);
  assert.match(users, /requirePermission\(request, "administration\.manage"\)/);
  assert.match(users, /This member already has portal access/);
  assert.match(users, /login email must match the member profile email/);
  assert.match(users, /memberId: linkedMember\?\.id/);
});

test("member portal returns only the signed-in member's scoped records", async () => {
  const route = await readFile(new URL("../app/api/member-portal/route.ts", import.meta.url), "utf8");
  assert.match(route, /requirePermission\(request, permission\)/);
  assert.match(route, /access\.user!\.memberId/);
  assert.match(route, /eq\(attendanceRecords\.memberId, member!\.id\)/);
  assert.match(route, /eq\(householdMembers\.memberId, member!\.id\)/);
  assert.match(route, /portal\.profile\.update/);
  assert.match(route, /fields: \["phone", "address"\]/);
  assert.doesNotMatch(route, /notes: member|emergencyPhone|financeTransactions|careCases/);
});

test("unauthorised browsers never receive the representative admin dashboard", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /useState<AccessProfile \| null>\(null\)/);
  assert.match(page, /if \(!access\) return <AccessScreen/);
  assert.match(page, /if \(access\.role === "member"\) return <MemberPortal/);
  assert.match(page, /There is no public registration/);
});

test("member identity link is persisted by migration", async () => {
  const migration = await readFile(new URL("../drizzle/0015_loud_sage.sql", import.meta.url), "utf8");
  assert.match(migration, /ALTER TABLE `users` ADD `member_id`/);
  assert.match(migration, /REFERENCES members\(id\)/);
});
