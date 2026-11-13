import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { RoleError, withRoleErrors } from "..";

describe("withRoleErrors", () => {
  it("renvoie la réponse du gestionnaire, traduit une RoleError et relance le reste", async () => {
    expect((await withRoleErrors(async () => NextResponse.json({ ok: true }))).status).toBe(200);
    const res = await withRoleErrors(async () => {
      throw new RoleError("SELF_MODIFICATION");
    });
    expect(res.status).toBe(403);
    await expect(
      withRoleErrors(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
