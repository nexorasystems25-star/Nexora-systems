/**
 * Integration smoke test for the D6 branch/campus model.
 *
 * Validates, against the live Supabase DB:
 *  - branch_id columns exist on all tenant tables
 *  - the branches table + auth_allowed_branch_ids(uuid) helper exist
 *  - the branch-scoping filter pattern (applyBranchFilter) isolates rows by branch set
 *  - the "set primary" pattern leaves exactly one primary branch per org
 *
 * All writes run inside BEGIN ... ROLLBACK, so no data is persisted.
 * Run with:  npx tsx scripts/test-branch-model.ts
 */
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const url =
  "postgresql://postgres.azhfmmocgireoqwhtmai:Kofi070789%40%24@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";
const sql = postgres(url, { max: 1 });

const GRAG_ORG = "85ff33bf-f72a-483b-93eb-1d65a9fc54fa";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  PASS  ${name}`);
  else {
    failures++;
    console.error(`  FAIL  ${name}  ${detail}`);
  }
}

async function main() {
  await sql`begin`;

  // T1 — branch_id columns on all 7 tenant tables
  const cols = await sql`select table_name from information_schema.columns where table_schema='public' and column_name='branch_id'`;
  const have = new Set(cols.map((c: any) => c.table_name));
  const expected = [
    "cf_checkin_children",
    "cf_events",
    "cf_finance_funds",
    "cf_finance_transactions",
    "cf_members",
    "invitations",
    "memberships",
  ];
  const missing = expected.filter((t) => !have.has(t));
  check("branch_id present on all 7 tenant tables", missing.length === 0, `missing: ${missing.join(", ")}`);

  // T2 — branches table + helper function
  const bt = await sql`select to_regclass('public.branches') as t`;
  check("branches table exists", bt[0].t != null);
  const fn = await sql`select to_regprocedure('public.auth_allowed_branch_ids(uuid)') as p`;
  check("auth_allowed_branch_ids(uuid) exists", fn[0].p != null);

  // T3 — applyBranchFilter pattern: non-org-wide filters to the branch set; NULL excluded
  await sql`create temp table _t (id int, branch_id uuid)`;
  const b1 = randomUUID();
  const b2 = randomUUID();
  await sql`insert into _t values (1, ${b1}), (2, ${b2}), (3, null)`;

  const scoped = await sql`select id from _t where branch_id = ${b1}::uuid`;
  check("scoped filter returns only the selected branch", scoped.length === 1 && scoped[0].id === 1, JSON.stringify(scoped));

  const orgWide = await sql`select id from _t where branch_id is null or branch_id = ${b1}::uuid or branch_id = ${b2}::uuid`;
  check("org-wide filter returns all rows (incl. NULL)", orgWide.length === 3, JSON.stringify(orgWide));
  await sql`drop table _t`;

  // T4 — setPrimary pattern: exactly one primary per org
  const org = await sql`select id from public.organizations where id = ${GRAG_ORG}::uuid limit 1`;
  if (org[0]?.id) {
    const bid1 = randomUUID();
    const bid2 = randomUUID();
    await sql`insert into public.branches (id, organization_id, name, slug, is_primary) values (${bid1}, ${org[0].id}, 'Test A', 'test-a', true), (${bid2}, ${org[0].id}, 'Test B', 'test-b', false)`;
    await sql`update public.branches set is_primary = false where organization_id = ${org[0].id}`;
    await sql`update public.branches set is_primary = true where id = ${bid2}`;
    const primaries = await sql`select count(*)::int as c from public.branches where organization_id = ${org[0].id} and is_primary = true`;
    check("setPrimary leaves exactly one primary branch", primaries[0].c === 1, `count=${primaries[0].c}`);
    await sql`delete from public.branches where id in (${bid1}::uuid, ${bid2}::uuid)`;
  } else {
    console.log("  SKIP  primary-branch test (GRAG org row not found in public.organizations)");
  }

  await sql`rollback`;

  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  await sql`rollback`.catch(() => {});
  console.error("ERROR", e);
  await sql.end();
  process.exit(1);
});
