import { NextResponse } from "next/server";

export type RoleErrorCode =
  | "NOT_FOUND"
  | "INVALID_ROLE"
  | "INVALID_PERMISSION"
  | "RESERVED_PERMISSION"
  | "PERMISSION_NOT_HELD"
  | "SELF_MODIFICATION"
  | "OWNER_PROTECTED"
  | "ROLE_NAME_TAKEN"
  | "ROLE_IN_USE"
  | "SYSTEM_ROLE";

const STATUS: Record<RoleErrorCode, 400 | 403 | 404 | 409> = {
  NOT_FOUND: 404,
  INVALID_ROLE: 400,
  INVALID_PERMISSION: 400,
  RESERVED_PERMISSION: 403,
  PERMISSION_NOT_HELD: 403,
  SELF_MODIFICATION: 403,
  OWNER_PROTECTED: 403,
  ROLE_NAME_TAKEN: 409,
  ROLE_IN_USE: 409,
  SYSTEM_ROLE: 409,
};

export class RoleError extends Error {
  readonly status: 400 | 403 | 404 | 409;

  constructor(
    public readonly code: RoleErrorCode,
    public readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.status = STATUS[code];
  }
}

/** Réponse HTTP d'une `RoleError` ; `null` pour toute autre erreur (à relancer). */
export function roleErrorResponse(err: unknown): NextResponse | null {
  if (!(err instanceof RoleError)) return null;
  return NextResponse.json(
    { error: err.code, ...(err.detail ? { detail: err.detail } : {}) },
    { status: err.status },
  );
}
