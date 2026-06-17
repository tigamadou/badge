import { promises as fs } from "node:fs";
import path from "node:path";
import { generateQRCodeDataURL } from "@/lib/qrcode";
import type { TemplateContext } from "./types";

// Forme du Registration attendue par buildTemplateContext. On accepte un objet
// avec relation event + category deja chargees. Les colonnes snapshot* sont
// utilisees pour reproduire l'identite figee a l'inscription/resoumission.
export type RegistrationForContext = {
  id: string;
  snapshotFirstName: string;
  snapshotLastName: string;
  snapshotStructure: string;
  snapshotPhoto: string;
  event: {
    title: string;
    date: Date;
    location: string;
    logo: string | null;
  };
  category: {
    name: string;
    color: string;
    neutralBadge: boolean;
    anonymous: boolean;
  };
};

export type BuildContextOptions = {
  // Base URL utilisee pour composer le verifyUrl du QR. Si absent : fallback
  // sur BASE_URL/NEXTAUTH_URL ou http://localhost:3000.
  baseUrl?: string;
  // Racine du systeme de fichiers d'uploads. Par defaut process.cwd()/uploads.
  // Surcharger en test pour pointer sur des fixtures.
  uploadsRoot?: string;
};

function resolveBaseUrl(explicit?: string): string {
  const raw =
    explicit ||
    process.env.BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

function resolveUploadsRoot(explicit?: string): string {
  return explicit ?? process.env.UPLOADS_ROOT ?? path.resolve(process.cwd(), "uploads");
}

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

async function readFileAsDataUrl(
  storageKey: string,
  uploadsRoot: string,
): Promise<string> {
  const filePath = path.join(uploadsRoot, storageKey);
  const buf = await fs.readFile(filePath);
  const ext = path.extname(storageKey).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// Indirection mockable pour les tests. Voir __TEST__ ci-dessous.
const internals = {
  readFileAsDataUrl,
  generateQRCodeDataURL,
};

export async function buildTemplateContext(
  registration: RegistrationForContext,
  options?: BuildContextOptions,
): Promise<TemplateContext> {
  const uploadsRoot = resolveUploadsRoot(options?.uploadsRoot);
  const baseUrl = resolveBaseUrl(options?.baseUrl);
  const verifyUrl = `${baseUrl}/verify/${encodeURIComponent(registration.id)}`;

  const [photoDataUrl, logoDataUrl, qrCodeDataUrl] = await Promise.all([
    internals.readFileAsDataUrl(registration.snapshotPhoto, uploadsRoot).catch(() => ""),
    registration.event.logo
      ? internals
          .readFileAsDataUrl(registration.event.logo, uploadsRoot)
          .catch(() => null)
      : Promise.resolve(null),
    internals.generateQRCodeDataURL(verifyUrl),
  ]);

  return {
    participant: {
      firstName: registration.snapshotFirstName,
      lastName: registration.snapshotLastName,
      structure: registration.snapshotStructure,
      photoDataUrl,
    },
    category: {
      name: registration.category.name,
      color: registration.category.color,
      neutralBadge: registration.category.neutralBadge,
      anonymous: registration.category.anonymous,
    },
    event: {
      title: registration.event.title,
      date: registration.event.date,
      location: registration.event.location,
      logoDataUrl,
    },
    badge: {
      id: registration.id,
      verifyUrl,
      qrCodeDataUrl,
    },
  };
}

// Surface privee reservee aux tests : permet de mocker readFileAsDataUrl et
// generateQRCodeDataURL sans toucher au reseau ni au filesystem reel.
export const __TEST__ = internals;
