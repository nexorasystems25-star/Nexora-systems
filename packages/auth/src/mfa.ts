import { db } from "@nexora/db";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import { createHmac } from "crypto";

// ============================================================================
// MFA (Multi-Factor Authentication) Helpers
// ============================================================================

// Secret key for TOTP — in production, use env var
const TOTP_SECRET = process.env.MFA_SECRET || "nexora-mfa-secret-key";

/**
 * Check if MFA is enabled for a user
 */
export async function isMFAEnabled(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return user?.mfaEnabled ?? false;
}

/**
 * Generate a TOTP code for a user (for testing/setup purposes)
 */
export function generateTOTPCode(userId: string, timestamp?: number): string {
  const time = timestamp || Math.floor(Date.now() / 30000); // 30-second window
  const data = `${userId}:${time}`;
  
  const hmac = createHmac("sha256", TOTP_SECRET);
  hmac.update(data);
  const hash = hmac.digest("hex");
  
  // Take last 6 digits
  const code = parseInt(hash.slice(-6), 16) % 1000000;
  return code.toString().padStart(6, "0");
}

/**
 * Verify a TOTP code for a user
 * Checks current and previous time window (60 seconds tolerance)
 */
export async function verifyMFACode(
  userId: string,
  code: string
): Promise<boolean> {
  if (!code || code.length !== 6) {
    return false;
  }

  const currentTime = Math.floor(Date.now() / 30000);
  
  // Check current time window and previous one (60s tolerance)
  for (let offset = 0; offset <= 1; offset++) {
    const expectedCode = generateTOTPCode(userId, currentTime - offset);
    if (expectedCode === code) {
      return true;
    }
  }

  // Also check next time window (for clock skew)
  const nextCode = generateTOTPCode(userId, currentTime + 1);
  if (nextCode === code) {
    return true;
  }

  return false;
}

/**
 * Setup MFA for a user — enable MFA flag
 */
export async function enableMFA(userId: string): Promise<{ success: boolean; secret: string }> {
  await db
    .update(users)
    .set({ mfaEnabled: true })
    .where(eq(users.id, userId));

  return {
    success: true,
    secret: TOTP_SECRET,
  };
}

/**
 * Disable MFA for a user
 */
export async function disableMFA(userId: string): Promise<boolean> {
  await db
    .update(users)
    .set({ mfaEnabled: false })
    .where(eq(users.id, userId));

  return true;
}
