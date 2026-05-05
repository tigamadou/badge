"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { generateQRCodeDataURL } from "@/lib/qrcode";

const BadgePreview = dynamic(
  () => import("@/components/badge/BadgePreview").then((m) => m.BadgePreview),
  { ssr: false }
);
const BadgeDownload = dynamic(
  () => import("@/components/badge/BadgeDownload").then((m) => m.BadgeDownload),
  { ssr: false }
);

export default function BadgePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ registration: Record<string, string & { team: { name: string; color: string } }>; event: Record<string, string>; valid: boolean } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  useEffect(() => {
    fetch(`/api/verify/${id}`).then((r) => r.json()).then(setData);
  }, [id]);

  useEffect(() => {
    if (data?.registration) {
      generateQRCodeDataURL(data.registration.id).then(setQrCodeDataUrl);
    }
  }, [data]);

  if (!data) return <p className="text-center mt-20">Chargement...</p>;
  if (!data.valid) return <p className="text-center mt-20 text-red-500">Badge non valide ou inscription non approuvée.</p>;

  const reg = data.registration as unknown as {
    id: string;
    lastName: string;
    firstName: string;
    structure: string;
    photo: string | null;
    status: string;
    team: { name: string; color: string };
  };
  const evt = data.event as unknown as { title: string; location: string; date: string };

  const registration = {
    id: reg.id,
    lastName: reg.lastName,
    firstName: reg.firstName,
    structure: reg.structure,
    photo: reg.photo ? `/api/files/${reg.photo}` : "",
    email: "",
    idDocumentType: "",
    idDocumentNumber: "",
    idDocument: "",
    teamId: "",
    status: reg.status as "approved",
  };

  const team = { id: "", name: reg.team.name, color: reg.team.color };
  const event = { id: "", title: evt.title, location: evt.location, date: evt.date, logo: "" };

  if (!qrCodeDataUrl) return <p className="text-center mt-20">Génération du badge...</p>;

  return (
    <div className="max-w-md mx-auto mt-10 text-center">
      <h1 className="text-xl font-bold mb-6">Votre badge</h1>
      <BadgePreview registration={registration} team={team} event={event} qrCodeDataUrl={qrCodeDataUrl} />
      <div className="mt-4">
        <BadgeDownload registration={registration} team={team} event={event} qrCodeDataUrl={qrCodeDataUrl} />
      </div>
    </div>
  );
}
