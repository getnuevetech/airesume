/** Stable MFA-gate dependency key for the signed-in account. */

export function mfaGateUserKey(user: { id?: string } | null | undefined): string | null {
  return user?.id || null;
}
