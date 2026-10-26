import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { runAsyncAction } from "@/hooks/useAsyncAction";

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("runAsyncAction", () => {
  it("passe pending à true puis false et affiche le toast de succès", async () => {
    const setPending = vi.fn();
    const guard = { current: false };
    await runAsyncAction(async () => "ok", { success: "Inscription resoumise." }, guard, setPending);
    expect(setPending.mock.calls).toEqual([[true], [false]]);
    expect(toast.success).toHaveBeenCalledWith("Inscription resoumise.");
    expect(guard.current).toBe(false);
  });

  it("appelle onSuccess avec le résultat de l'action", async () => {
    const onSuccess = vi.fn();
    await runAsyncAction(async () => 42, { onSuccess }, { current: false }, vi.fn());
    expect(onSuccess).toHaveBeenCalledWith(42);
  });

  it("n'affiche pas de toast de succès sans option success", async () => {
    await runAsyncAction(async () => 1, undefined, { current: false }, vi.fn());
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("affiche le message error de la réponse API levée", async () => {
    const setPending = vi.fn();
    const guard = { current: false };
    await runAsyncAction(
      async () => {
        throw new Response(JSON.stringify({ error: "Accès refusé." }), { status: 403 });
      },
      { error: "Resoumission impossible." },
      guard,
      setPending,
    );
    expect(toast.error).toHaveBeenCalledWith("Accès refusé.");
    expect(setPending).toHaveBeenLastCalledWith(false);
    expect(guard.current).toBe(false);
  });

  it("utilise l'option error comme repli", async () => {
    await runAsyncAction(
      async () => {
        throw new TypeError("Failed to fetch");
      },
      { error: "Resoumission impossible." },
      { current: false },
      vi.fn(),
    );
    expect(toast.error).toHaveBeenCalledWith("Resoumission impossible.");
  });

  it("n'affiche que le toast d'erreur quand onSuccess lève", async () => {
    await runAsyncAction(
      async () => 1,
      {
        success: "Fait.",
        error: "Échec.",
        onSuccess: () => {
          throw new Error("boom");
        },
      },
      { current: false },
      vi.fn(),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Échec.");
  });

  it("ignore un second appel lancé avant la fin du premier", async () => {
    let release!: () => void;
    const action = vi.fn(
      () => new Promise<void>((resolve) => { release = resolve; }),
    );
    const guard = { current: false };
    const setPending = vi.fn();
    const first = runAsyncAction(action, undefined, guard, setPending);
    const second = runAsyncAction(action, undefined, guard, setPending);
    expect(action).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    const third = runAsyncAction(action, undefined, guard, setPending);
    expect(action).toHaveBeenCalledTimes(2);
    release();
    await third;
  });

  it("transmet les arguments à l'action", async () => {
    const action = vi.fn(async (role: string, id: number) => `${role}-${id}`);
    const onSuccess = vi.fn();
    await runAsyncAction(action, { onSuccess }, { current: false }, vi.fn(), ["ADMIN", 3]);
    expect(action).toHaveBeenCalledWith("ADMIN", 3);
    expect(onSuccess).toHaveBeenCalledWith("ADMIN-3");
  });
});
