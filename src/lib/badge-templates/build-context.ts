import path from "node:path";
import { generateQRCodeDataURL } from "@/lib/qrcode";
import { registrationVerifyUrl } from "@/lib/registration-qr";
import { getFile } from "@/lib/storage";
import { readSecurityInstructions } from "@/lib/security-instructions";
import { readTemplateOptions } from "./template-options";
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
  allAccessGranted: boolean;
  event: {
    title: string;
    date: Date;
    location: string;
    logo: string | null;
    // Valeur brute de la colonne JSON.
    securityInstructions: unknown;
    banner: string | null;
    // Valeur brute de la colonne JSON.
    templateOptions: unknown;
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
  // Noms des options image du template rendu (a charger en data URL).
  optionImages?: string[];
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

// v4 : lecture via le driver de stockage S3 (MinIO). L'ancienne lecture filesystem
// locale ne trouvait plus les fichiers depuis la bascule S3. `uploadsRoot` est
// conserve dans la signature pour compat (mock de test) mais ignore.
async function readFileAsDataUrl(
  storageKey: string,
  _uploadsRoot: string,
): Promise<string> {
  const { body, contentType } = await getFile(storageKey);
  const ext = path.extname(storageKey).toLowerCase();
  const mime = contentType && contentType !== "application/octet-stream"
    ? contentType
    : MIME_BY_EXT[ext] ?? "application/octet-stream";
  return `data:${mime};base64,${body.toString("base64")}`;
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
  const verifyUrl = registrationVerifyUrl(baseUrl, registration.id);

  const [photoDataUrl, logoDataUrl, bannerDataUrl, qrCodeDataUrl] = await Promise.all([
    internals.readFileAsDataUrl(registration.snapshotPhoto, uploadsRoot).catch(() => ""),
    registration.event.logo
      ? internals
          .readFileAsDataUrl(registration.event.logo, uploadsRoot)
          .catch(() => null)
      : Promise.resolve(null),
    registration.event.banner
      ? internals
          .readFileAsDataUrl(registration.event.banner, uploadsRoot)
          .catch(() => null)
      : Promise.resolve(null),
    internals.generateQRCodeDataURL(verifyUrl),
  ]);

  const templateOptions = readTemplateOptions(registration.event.templateOptions);
  const templateOptionImages: Record<string, string> = {};
  await Promise.all(
    (options?.optionImages ?? []).map(async (name) => {
      const key = templateOptions[name];
      if (typeof key !== "string" || key === "") return;
      const dataUrl = await internals.readFileAsDataUrl(key, uploadsRoot).catch(() => null);
      if (dataUrl) templateOptionImages[name] = dataUrl;
    }),
  );

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
      securityInstructions: readSecurityInstructions(registration.event.securityInstructions),
      bannerDataUrl,
      templateOptions,
      templateOptionImages,
    },
    badge: {
      id: registration.id,
      verifyUrl,
      qrCodeDataUrl,
      allAccess: registration.allAccessGranted,
    },
  };
}

// Surface privee reservee aux tests : permet de mocker readFileAsDataUrl et
// generateQRCodeDataURL sans toucher au reseau ni au filesystem reel.
export const __TEST__ = internals;
