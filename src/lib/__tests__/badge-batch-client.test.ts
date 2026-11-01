import { describe, it, expect, vi } from "vitest";
import { markInChunks, pollExport } from "../badge-batch-client";

const ok = (printed: number) => new Response(JSON.stringify({ ok: true, printed }), { status: 200 });
const status = (code: number) => new Response("{}", { status: code });
const exp = (s: string, fileKey: string | null = null) =>
  new Response(JSON.stringify({ export: { status: s, fileKey } }), { status: 200 });

describe("markInChunks", () => {
  const ids = Array.from({ length: 1200 }, (_, i) => `r${i}`);

  it("envoie 500, 500, 200 et notifie chaque paquet", async () => {
    const sizes: number[] = [];
    const seen: number[] = [];
    const r = await markInChunks(ids, async (p) => (sizes.push(p.length), ok(p.length)), (p) => seen.push(p.length));
    expect(sizes).toEqual([500, 500, 200]);
    expect(seen).toEqual([500, 500, 200]);
    expect(r).toEqual({ markedIds: ids, printed: 1200 });
  });

  it("paquet 2 en echec : le paquet 1 est conserve, le 3 n'est pas envoye", async () => {
    const send = vi.fn().mockResolvedValueOnce(ok(500)).mockResolvedValueOnce(status(500));
    const onChunk = vi.fn();
    const r = await markInChunks(ids, send, onChunk);
    expect(send).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(r.markedIds).toEqual(ids.slice(0, 500));
    expect(r.printed).toBe(500);
    expect(r.failure).toBeInstanceOf(Response);
  });

  it("une erreur reseau arrete aussi", async () => {
    const boom = new TypeError("fetch failed");
    const r = await markInChunks(ids, vi.fn().mockRejectedValue(boom));
    expect(r).toEqual({ markedIds: [], printed: 0, failure: boom });
  });
});

describe("pollExport", () => {
  const base = { sleep: async () => {}, cancelled: () => false, intervalMs: 3000 };

  it("termine sur DONE avec la cle du fichier", async () => {
    const fetchStatus = vi.fn().mockResolvedValueOnce(exp("PENDING")).mockResolvedValueOnce(exp("DONE", "k.zip"));
    expect(await pollExport({ ...base, fetchStatus })).toEqual({ kind: "done", fileKey: "k.zip" });
  });

  it("FAILED termine en echec", async () => {
    const r = await pollExport({ ...base, fetchStatus: async () => exp("FAILED") });
    expect(r.kind).toBe("failed");
  });

  it.each([401, 403, 404])("%i arrete immediatement", async (code) => {
    const fetchStatus = vi.fn().mockResolvedValue(status(code));
    const r = await pollExport({ ...base, fetchStatus });
    expect(r.kind).toBe("failed");
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  it("5xx et reseau transitoires : on continue puis DONE", async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(status(503))
      .mockRejectedValueOnce(new TypeError("x"))
      .mockResolvedValueOnce(exp("DONE", "k.zip"));
    expect((await pollExport({ ...base, fetchStatus })).kind).toBe("done");
  });

  it("abandonne apres 10 echecs consecutifs", async () => {
    const fetchStatus = vi.fn().mockResolvedValue(status(503));
    const r = await pollExport({ ...base, fetchStatus });
    expect(r.kind).toBe("failed");
    expect(fetchStatus).toHaveBeenCalledTimes(10);
  });

  it("un succes remet le compteur a zero", async () => {
    const fetchStatus = vi.fn();
    for (let i = 0; i < 9; i++) fetchStatus.mockResolvedValueOnce(status(500));
    fetchStatus.mockResolvedValueOnce(exp("PENDING"));
    for (let i = 0; i < 9; i++) fetchStatus.mockResolvedValueOnce(status(500));
    fetchStatus.mockResolvedValueOnce(exp("DONE", "k.zip"));
    expect((await pollExport({ ...base, fetchStatus })).kind).toBe("done");
  });

  it("jamais deux requetes en vol", async () => {
    let inFlight = 0;
    let max = 0;
    let n = 0;
    const fetchStatus = async () => {
      inFlight += 1;
      max = Math.max(max, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return exp(++n < 4 ? "PENDING" : "DONE", "k.zip");
    };
    await pollExport({ ...base, fetchStatus });
    expect(max).toBe(1);
  });

  it("annule : plus aucune requete", async () => {
    const fetchStatus = vi.fn();
    expect(await pollExport({ ...base, cancelled: () => true, fetchStatus })).toEqual({ kind: "cancelled" });
    expect(fetchStatus).not.toHaveBeenCalled();
  });
});
