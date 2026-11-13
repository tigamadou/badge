import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth-guards";
import { RoleError, withRoleErrors } from "..";

describe("withRoleErrors", () => {
  it("renvoie la réponse du gestionnaire, traduit une RoleError et relance le reste", async () => {
    expect((await withRoleErrors(async () => NextResponse.json({ ok: true }))).status).toBe(200);
    const res = await withRoleErrors(async () => {
      throw new RoleError("SELF_MODIFICATION");
    });
    expect(res.status).toBe(403);
    const auth = await withRoleErrors(async () => {
      throw new AuthError("LAST_SUPER_ADMIN", 409);
    });
    expect([auth.status, await auth.json()]).toEqual([409, { error: "LAST_SUPER_ADMIN" }]);
    await expect(
      withRoleErrors(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
