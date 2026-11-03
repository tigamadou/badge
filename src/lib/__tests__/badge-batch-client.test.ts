import { describe, it, expect, vi } from "vitest";
import {
  exportStorageKey,
  forgetExport,
  markInChunks,
  pollExport,
  readSelection,
  recallExport,
  rememberExport,
  SELECTION_KEY_PREFIX,
  storeSelection,
  type KeyValueStore,
} from "../badge-batch-client";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

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

  it("annule pendant la requete : la reponse est ignoree", async () => {
    let flag = false;
    const fetchStatus = async () => ((flag = true), exp("DONE", "k.zip"));
    expect(await pollExport({ ...base, cancelled: () => flag, fetchStatus })).toEqual({ kind: "cancelled" });
  });

  it("annule : plus aucune requete", async () => {
    const fetchStatus = vi.fn();
    expect(await pollExport({ ...base, cancelled: () => true, fetchStatus })).toEqual({ kind: "cancelled" });
    expect(fetchStatus).not.toHaveBeenCalled();
  });
});

describe("pollExport : attente trop longue", () => {
  it("signale apres 5 minutes de PENDING, puis efface le signal quand l'export demarre", async () => {
    let clock = 0;
    const statuses = ["PENDING", "PENDING", "PENDING", "PENDING", "RUNNING", "DONE"];
    let i = 0;
    const fetchStatus = async () => exp(statuses[i++], statuses[i - 1] === "DONE" ? "k.zip" : null);
    const hint = vi.fn();
    const r = await pollExport({
      fetchStatus,
      sleep: async () => void (clock += 2 * 60_000), // 2 min par tour
      cancelled: () => false,
      intervalMs: 3000,
      now: () => clock,
      onPendingLong: hint,
    });
    expect(r.kind).toBe("done");
    // Premier PENDING vu a 2 min ; le 4e (8 min) depasse 5 min d'attente -> signal ; RUNNING l'efface.
    expect(hint.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it("pas de signal sous le seuil", async () => {
    let clock = 0;
    const hint = vi.fn();
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(exp("PENDING"))
      .mockResolvedValueOnce(exp("PENDING"))
      .mockResolvedValueOnce(exp("DONE", "k.zip"));
    await pollExport({
      fetchStatus,
      sleep: async () => void (clock += 60_000),
      cancelled: () => false,
      intervalMs: 3000,
      now: () => clock,
      onPendingLong: hint,
    });
    expect(hint).not.toHaveBeenCalled();
  });

  it("le signal n'est emis qu'une fois tant que PENDING dure, et le seuil est reglable", async () => {
    let clock = 0;
    const hint = vi.fn();
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(exp("PENDING"))
      .mockResolvedValueOnce(exp("PENDING"))
      .mockResolvedValueOnce(exp("PENDING"))
      .mockResolvedValueOnce(exp("FAILED"));
    const r = await pollExport({
      fetchStatus,
      sleep: async () => void (clock += 1000),
      cancelled: () => false,
      intervalMs: 3000,
      now: () => clock,
      pendingHintMs: 1500,
      onPendingLong: hint,
    });
    expect(r.kind).toBe("failed");
    // Une seule fois a true malgre trois PENDING au-dela du seuil ; le FAILED final l'efface.
    expect(hint.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it("fonctionne sans callback ni horloge fournis", async () => {
    const fetchStatus = vi.fn().mockResolvedValueOnce(exp("PENDING")).mockResolvedValueOnce(exp("DONE", "k.zip"));
    expect((await pollExport({ sleep: async () => {}, cancelled: () => false, intervalMs: 1, fetchStatus })).kind).toBe(
      "done",
    );
  });
});

describe("selection transportee hors URL", () => {
  it("stocke 5 000 identifiants sous une cle aleatoire et les relit dans l'ordre", () => {
    const store = memoryStore();
    const ids = Array.from({ length: 5000 }, (_, i) => `r${i}`);
    const key = storeSelection(store, ids);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(readSelection(store, key)).toEqual(ids);
    expect(storeSelection(store, ids)).not.toBe(key);
  });

  it("une nouvelle selection purge les anciennes mais pas les autres cles", () => {
    const store = memoryStore();
    store.setItem("autre", "x");
    const first = storeSelection(store, ["a"]);
    const second = storeSelection(store, ["b"]);
    expect(readSelection(store, first)).toBeNull();
    expect(readSelection(store, second)).toEqual(["b"]);
    expect(store.getItem("autre")).toBe("x");
    expect([...store.data.keys()].filter((k) => k.startsWith(SELECTION_KEY_PREFIX))).toHaveLength(1);
  });

  it("readSelection renvoie null : cle absente ou vide, JSON invalide, mauvais type, liste vide", () => {
    const store = memoryStore();
    expect(readSelection(store, null)).toBeNull();
    expect(readSelection(store, "")).toBeNull();
    expect(readSelection(store, "absente")).toBeNull();
    for (const raw of ["{pas du json", '{"a":1}', "[1,2]", '["a",""]', "[]"]) {
      store.setItem(`${SELECTION_KEY_PREFIX}k`, raw);
      expect(readSelection(store, "k")).toBeNull();
    }
  });

  it("readSelection renvoie null si le stockage jette", () => {
    const store = memoryStore();
    store.getItem = () => {
      throw new Error("bloque");
    };
    expect(readSelection(store, "k")).toBeNull();
  });

  it("storeSelection renvoie null si l'ecriture echoue (quota, mode prive)", () => {
    const store = memoryStore();
    store.setItem = () => {
      throw new Error("quota");
    };
    expect(storeSelection(store, ["a"])).toBeNull();
  });

  it("la purge ignore un stockage dont la lecture des cles jette", () => {
    const store = memoryStore();
    store.key = () => {
      throw new Error("x");
    };
    store.setItem("badge-batch-sel:old", "[]");
    expect(storeSelection(store, ["a"])).not.toBeNull();
  });
});

describe("export memorise pour reprendre apres rechargement", () => {
  it("memorise, relit et oublie, par evenement et par selection", () => {
    const store = memoryStore();
    expect(exportStorageKey("e1", "s1")).not.toBe(exportStorageKey("e2", "s1"));
    expect(exportStorageKey("e1", "s1")).not.toBe(exportStorageKey("e1", "s2"));
    expect(recallExport(store, "e1", "s1")).toBeNull();
    rememberExport(store, "e1", "s1", "exp-1");
    expect(recallExport(store, "e1", "s1")).toBe("exp-1");
    expect(recallExport(store, "e1", "s2")).toBeNull();
    forgetExport(store, "e1", "s1");
    expect(recallExport(store, "e1", "s1")).toBeNull();
  });

  it("ne jette jamais si le stockage est indisponible", () => {
    const boom = () => {
      throw new Error("bloque");
    };
    const store = { ...memoryStore(), getItem: boom, setItem: boom, removeItem: boom };
    expect(() => rememberExport(store, "e", "s", "x")).not.toThrow();
    expect(recallExport(store, "e", "s")).toBeNull();
    expect(() => forgetExport(store, "e", "s")).not.toThrow();
  });
});
