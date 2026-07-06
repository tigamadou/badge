"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { generateQRCodeDataURL } from "@/lib/qrcode";
import { formatEventDate } from "@/lib/format-date";
import { imageUrlToDataUrl } from "@/lib/image-to-dataurl";
import { BadgeCard } from "@/components/badge/BadgeCard";
import { Spinner } from "@/components/ui/Feedback";

const BadgeDownload = dynamic(
  () => import("@/components/badge/BadgeDownload").then((m) => m.BadgeDownload),
  { ssr: false }
);

export default function BadgePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ registration: Record<string, string & { team: { name: string; color: string } }>; event: Record<string, string>; valid: boolean } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");

  useEffect(() => {
    fetch(`/api/verify/${id}`).then((r) => r.json()).then(setData);
  }, [id]);

  useEffect(() => {
    if (data?.registration) {
      generateQRCodeDataURL(data.registration.id).then(setQrCodeDataUrl);
      const reg = data.registration as unknown as { photo: string | null };
      if (reg.photo) {
        imageUrlToDataUrl(`/api/files/${reg.photo}`).then(setPhotoDataUrl).catch(() => setPhotoDataUrl(""));
      }
    }
  }, [data]);

  if (!data)
    return (
      <div className="mt-20 text-center">
        <Spinner />
      </div>
    );
  if (!data.valid)
    return <p className="mt-20 text-center text-rose-600">Badge non valide ou inscription non approuvée.</p>;

  const reg = data.registration as unknown as {
    id: string;
    lastName: string;
    firstName: string;
    structure: string;
    photo: string | null;
    status: string;
    allAccessGranted: boolean;
    team: { name: string; color: string; neutralBadge?: boolean; anonymous?: boolean };
  };
  const evt = data.event as unknown as { title: string; location: string; date: string };

  const registration = {
    id: reg.id,
    lastName: reg.lastName,
    firstName: reg.firstName,
    structure: reg.structure,
    photo: photoDataUrl || (reg.photo ? `/api/files/${reg.photo}` : ""),
    email: "",
    idDocumentType: "",
    idDocumentNumber: "",
    idDocument: "",
    teamId: "",
    status: reg.status as "APPROVED",
    allAccessGranted: reg.allAccessGranted,
  };

  const team = { id: "", name: reg.team.name, color: reg.team.color, number: 0, neutralBadge: reg.team.neutralBadge ?? false, anonymous: reg.team.anonymous ?? false };
  const event = { id: "", title: evt.title, location: evt.location, date: formatEventDate(evt.date), logo: "" };

  if (!qrCodeDataUrl)
    return (
      <div className="mt-20 flex items-center justify-center gap-2 text-slate-500">
        <Spinner /> Génération du badge…
      </div>
    );

  // Apercu web via BadgeCard (HTML). Le PDF officiel reste genere par BadgeDownload.
  // Anonymat : on masque l'identite dans l'apercu web quand la categorie est anonyme,
  // pour rester coherent avec le rendu PDF anonyme.
  const anonymous = team.anonymous;
  const displayName = anonymous ? "Identité masquée" : `${reg.firstName} ${reg.lastName}`;

  return (
    <div className="mx-auto mt-10 max-w-md px-4 text-center">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Votre badge</h1>
      <div className="flex justify-center">
        <BadgeCard
          org={event.title}
          name={displayName}
          role={anonymous ? undefined : reg.structure}
          category={team.name}
          categoryColor={team.neutralBadge ? "#334155" : team.color}
          qr={
            qrCodeDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCodeDataUrl} alt="QR code du badge" className="h-full w-full" />
            ) : null
          }
          meta={
            <>
              N° {reg.id}
              <br />
              {event.location} · {event.date}
            </>
          }
          allAccess={reg.allAccessGranted}
        />
      </div>
      <p className="mt-3 text-xs text-slate-400">Format 100 × 140 mm</p>
      <div className="mt-4 flex justify-center">
        <BadgeDownload registration={registration} team={team} event={event} qrCodeDataUrl={qrCodeDataUrl} allAccessGranted={reg.allAccessGranted} />
      </div>
    </div>
  );
}
