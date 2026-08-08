import { getAccessUser } from "../_access";
import { rolePolicies } from "../../../lib/access";

export async function GET(request: Request) {
  try {
    const user = await getAccessUser(request);
    if (!user) return Response.json({ error: "Account not authorised" }, { status: 401 });
    return Response.json({ user, roles: rolePolicies });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load access profile" }, { status: 500 });
  }
}
