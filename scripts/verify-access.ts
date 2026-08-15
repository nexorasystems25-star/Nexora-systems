import { requireScope, type AccessContext } from "../apps/churchflow/src/lib/access";

function ctx(over: Partial<AccessContext> = {}): AccessContext {
  return {
    orgId: "org-1",
    userId: "u-1",
    email: "a@b.co",
    role: "admin",
    isSuperAdmin: false,
    actorScope: "tenant",
    productId: undefined,
    productRoles: [],
    ...over,
  };
}

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

check("platform scope rejects tenant user", requireScope(ctx(), "platform")?.status === 403);
check("platform scope allows platform user", requireScope(ctx({ actorScope: "platform", isSuperAdmin: true }), "platform") === null);
check("product scope rejects wrong-product admin", requireScope(ctx({ actorScope: "product", productId: "p-2" }), "product", "p-1")?.status === 403);
check("product scope allows matching product admin", requireScope(ctx({ actorScope: "product", productId: "p-1" }), "product", "p-1") === null);
check("unauthenticated returns 401", requireScope(null, "tenant")?.status === 401);
check("tenant scope allows any authenticated", requireScope(ctx(), "tenant") === null);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll access-guard checks passed");
