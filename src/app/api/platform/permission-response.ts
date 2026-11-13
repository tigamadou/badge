import { NextResponse } from "next/server";
import { AuthError, requirePermission } from "@/lib/auth-guards";
import type { Permission, PermissionTarget } from "@/lib/permissions";

/**
 * Second contrôle de permission dans un handler (cas à plusieurs droits) :
 * `null` si autorisé, sinon la réponse d'erreur (403 PERMISSION_DENIED par défaut).
 */
export async function permissionDenied(
  userId: string,
  permission: Permission | readonly Permission[],
  target: PermissionTarget = { kind: "platform" },
): Promise<NextResponse | null> {
  try {
    await requirePermission(userId, permission, target);
    return null;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    }
    throw err;
  }
}
