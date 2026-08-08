import { db } from "@nexora/db";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";

export async function isMFAEnabled(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return user?.mfaEnabled ?? false;
}

export async function verifyMFACode(
  userId: string,
  code: string
): Promise<boolean> {
  // TODO: Implement TOTP verification
  // For now, return true (MFA not yet implemented)
  console.log(`MFA verification for user ${userId}: ${code}`);
  return true;
}