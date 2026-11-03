// Execution d'une generation d'impression par le worker : reservation (SKIP LOCKED),
// rendu des badges avec battement de coeur, composition des planches ou archive ZIP,
// reprise des generations orphelines.
import JSZip from "jszip";
import type { PrintSheetGeneration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFile, uploadFile } from "@/lib/storage";
import { BATCH_RENDER_CONCURRENCY, badgeFileName, mapWithConcurrency } from "@/lib/badge-batch";
import { loadBadgeRegistration, renderBadgePdf } from "@/lib/badge-templates/render-badge";
import { appendThreadEvent } from "@/lib/print-requests/thread";
import { PRINT_SHEETS_MAX_ATTEMPTS, PRINT_SHEETS_STALE_MS } from "@/lib/jobs/constants";
import { computeSheetLayout } from "./compute-layout";
import { BadgeSizeMismatchError, composeSheets } from "./compose";
import type { GenerationSnapshot } from "./generations";

export type RunDeps = {
  // null = inscription absente ou non APPROVED.
  renderBadge(registrationId: string): Promise<{ pdf: Uint8Array; fileName: string } | null>;
  upload(key: string, body: Uint8Array, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  now(): Date;
  // Periode du battement entre la fin du rendu et l'ecriture finale (composition, ZIP, envoi).
  beatIntervalMs?: number;
};

export const POST_RENDER_BEAT_MS = 30_000;

export const defaultRunDeps: RunDeps = {
  async renderBadge(registrationId) {
    const registration = await loadBadgeRegistration(registrationId);
    if (!registration || registration.status !== "APPROVED") return null;
    const { pdf } = await renderBadgePdf(registration);
    return { pdf, fileName: badgeFileName({ ...registration, id: registration.id }) };
  },
  async upload(key, body, contentType) {
    await uploadFile(key, Buffer.from(body), contentType);
  },
  async remove(key) {
    await deleteFile(key);
  },
  now: () => new Date(),
};

// Reserve la plus ancienne generation PENDING ; SKIP LOCKED evite qu'un autre worker
// prenne la meme ligne.
export async function claimGeneration(opts: {
  workerId: string;
  now: Date;
}): Promise<PrintSheetGeneration | null> {
  const { workerId, now } = opts;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM \`PrintSheetGeneration\`
      WHERE status = 'PENDING'
      ORDER BY createdAt ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED`;
    if (rows.length === 0) return null;
    return tx.printSheetGeneration.update({
      where: { id: rows[0].id },
      data: {
        status: "RUNNING",
        lockedBy: workerId,
        heartbeatAt: now,
        startedAt: now,
        attempts: { increment: 1 },
      },
    });
  });
}

class LockLostError extends Error {}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function runGeneration(
  generationId: string,
  workerId: string,
  deps: RunDeps = defaultRunDeps,
): Promise<"DONE" | "FAILED" | "LOCK_LOST"> {
  // Toute ecriture est conditionnee au verrou : si un autre worker a repris la ligne, on n'ecrit rien.
  const generation = await prisma.printSheetGeneration.findUnique({ where: { id: generationId } });
  if (!generation || generation.status !== "RUNNING" || generation.lockedBy !== workerId) {
    return "LOCK_LOST";
  }
  // `attempts` identifie la reservation en cours : une reprise puis nouvelle reservation par ce
  // meme worker ne doit pas laisser l'ancien run ecrire.
  const owned = {
    id: generationId,
    status: "RUNNING" as const,
    lockedBy: workerId,
    attempts: generation.attempts,
  };
  const write = async (data: Parameters<typeof prisma.printSheetGeneration.updateMany>[0]["data"]) =>
    (await prisma.printSheetGeneration.updateMany({ where: owned, data })).count > 0;

  let beat: ReturnType<typeof setInterval> | undefined;
  let lockLostByBeat = false;
  try {
    const ids = generation.registrationIds as string[];
    const rendered = await mapWithConcurrency(ids, BATCH_RENDER_CONCURRENCY, async (id) => {
      const badge = await deps.renderBadge(id);
      if (!(await write({ heartbeatAt: deps.now() }))) throw new LockLostError();
      return badge;
    });

    // Le rendu est fini : un battement periodique couvre composition, archive et envoi.
    beat = setInterval(() => {
      write({ heartbeatAt: deps.now() }).then(
        (ok) => {
          if (!ok) lockLostByBeat = true;
        },
        () => {}, // erreur transitoire : le prochain battement reessaiera
      );
    }, deps.beatIntervalMs ?? POST_RENDER_BEAT_MS);

    // Positions (1-based) dans la liste ordonnee de la generation, pour les messages d'erreur.
    const kept: { position: number; pdf: Uint8Array; fileName: string }[] = [];
    const skippedIds: string[] = [];
    rendered.forEach((badge, i) => {
      if (badge) kept.push({ position: i + 1, ...badge });
      else skippedIds.push(ids[i]);
    });
    if (kept.length === 0) {
      return (await write({
        status: "FAILED",
        error: "aucun badge à imprimer",
        skippedIds,
        completedAt: deps.now(),
      }))
        ? "FAILED"
        : "LOCK_LOST";
    }

    let key: string;
    let body: Uint8Array;
    let contentType: string;
    let sheetCount: number | null = null;
    if (generation.output === "ZIP") {
      const zip = new JSZip();
      for (const b of kept) zip.file(b.fileName, b.pdf);
      body = await zip.generateAsync({ type: "uint8array" });
      key = `badge-exports/${generation.eventId}/${generation.id}.zip`;
      contentType = "application/zip";
    } else {
      const snapshot = generation.layoutSnapshot as GenerationSnapshot;
      const layout = computeSheetLayout(snapshot.spec, {
        widthMm: snapshot.badgeMm.width,
        heightMm: snapshot.badgeMm.height,
      });
      try {
        const composed = await composeSheets({
          layout,
          spec: snapshot.spec,
          duplex: generation.duplex,
          badgeMm: snapshot.badgeMm,
          badges: kept.map((b) => b.pdf),
        });
        body = composed.pdf;
        sheetCount = composed.sheetCount;
      } catch (err) {
        if (err instanceof BadgeSizeMismatchError) {
          throw new Error(
            `le badge n° ${kept[err.badgeIndex].position} n'a pas le format attendu (le template a peut-être changé depuis la création)`,
          );
        }
        throw err;
      }
      // Planche d'une commande : clé stable, une regénération écrase le fichier précédent.
      key = generation.printRequestId
        ? `print-sheets/orders/${generation.printRequestId}.pdf`
        : `print-sheets/${generation.id}.pdf`;
      contentType = "application/pdf";
    }

    await deps.upload(key, body, contentType);
    if (lockLostByBeat) return "LOCK_LOST";
    const done = await write({
      status: "DONE",
      sheetCount,
      badgeCount: kept.length,
      skippedIds,
      fileKey: key,
      error: null,
      completedAt: deps.now(),
    });
    if (!done) return "LOCK_LOST";
    // Ancien fichier d'une regénération (autre clé, ex. planche créée avant la clé stable) : supprimé
    // seulement après le succès. Secondaire : un échec de suppression ne change pas le résultat.
    if (generation.fileKey && generation.fileKey !== key) {
      try {
        await deps.remove(generation.fileKey);
      } catch (err) {
        console.error("Ancien fichier de planche non supprimé", err);
      }
    }
    // Planches d'une commande : les badges ecartes sont signales dans son fil.
    if (generation.printRequestId && skippedIds.length > 0) {
      const requestId = generation.printRequestId;
      // Le fil est secondaire : la génération est DONE, son échec ne doit rien changer au résultat.
      try {
        await prisma.$transaction((tx) =>
          appendThreadEvent(tx, requestId, "REGISTRATIONS_SKIPPED", { registrationIds: skippedIds }),
        );
      } catch (err) {
        console.error("Entrée REGISTRATIONS_SKIPPED non écrite", err);
      }
    }
    return "DONE";
  } catch (err) {
    if (err instanceof LockLostError || lockLostByBeat) return "LOCK_LOST";
    return (await write({ status: "FAILED", error: message(err), completedAt: deps.now() }))
      ? "FAILED"
      : "LOCK_LOST";
  } finally {
    clearInterval(beat);
  }
}

// Arret propre du worker : rend la generation qu'il avait reservee, sans consommer d'essai
// (claim l'avait compte), pour qu'un autre worker la reprenne aussitot. Conditionnel a la
// reservation : le run encore en cours echouera sur sa condition de propriete (LOCK_LOST) et
// n'ecrira plus rien. false si la generation n'est plus RUNNING chez ce worker (deja terminee).
export async function releaseGeneration(generationId: string, workerId: string): Promise<boolean> {
  const { count } = await prisma.printSheetGeneration.updateMany({
    where: { id: generationId, status: "RUNNING", lockedBy: workerId },
    data: { status: "PENDING", lockedBy: null, heartbeatAt: null, attempts: { decrement: 1 } },
  });
  return count > 0;
}

// RUNNING sans battement recent : PENDING tant qu'il reste des essais, sinon FAILED.
export async function recoverStaleGenerations(now: Date): Promise<number> {
  const stale = {
    status: "RUNNING" as const,
    heartbeatAt: { lt: new Date(now.getTime() - PRINT_SHEETS_STALE_MS) },
  };
  const retried = await prisma.printSheetGeneration.updateMany({
    where: { ...stale, attempts: { lt: PRINT_SHEETS_MAX_ATTEMPTS } },
    data: { status: "PENDING", lockedBy: null, heartbeatAt: null },
  });
  const failed = await prisma.printSheetGeneration.updateMany({
    where: { ...stale, attempts: { gte: PRINT_SHEETS_MAX_ATTEMPTS } },
    data: {
      status: "FAILED",
      lockedBy: null,
      error: "génération interrompue trop de fois",
      completedAt: now,
    },
  });
  return retried.count + failed.count;
}
