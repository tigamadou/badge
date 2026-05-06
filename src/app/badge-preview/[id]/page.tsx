"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BadgeWebPreview } from "@/components/badge/BadgeWebPreview";
import { generateQRCodeDataURL } from "@/lib/qrcode";

export default function BadgePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    registration: Record<string, string & { team: { name: string; color: string } }>;
    event: Record<string, string>;
    valid: boolean;
  } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  useEffect(() => {
    fetch(`/api/verify/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  useEffect(() => {
    if (data?.registration) {
      generateQRCodeDataURL(data.registration.id).then(setQrCodeDataUrl);
    }
  }, [data]);

  if (!data) return <p className="text-center mt-20">Chargement...</p>;
  if (!data.valid)
    return (
      <p className="text-center mt-20 text-red-500">
        Badge non valide ou inscription non approuvée.
      </p>
    );

  const reg = data.registration as unknown as {
    id: string;
    lastName: string;
    firstName: string;
    structure: string;
    photo: string | null;
    status: string;
    allAccessGranted: boolean;
    team: { name: string; color: string };
  };
  const evt = data.event as unknown as {
    title: string;
    location: string;
    date: string;
    logo?: string;
  };

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
    status: reg.status as "APPROVED",
    allAccessGranted: reg.allAccessGranted,
  };

  const team = { id: "", name: reg.team.name, color: reg.team.color, number: 0 };
  const event = {
    id: "",
    title: evt.title,
    location: evt.location,
    date: evt.date,
    logo: evt.logo || "",
  };

  if (!qrCodeDataUrl)
    return <p className="text-center mt-20">Génération du badge...</p>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-xl font-bold mb-6">Aperçu du Badge</h1>
      <div className="shadow-2xl">
        <BadgeWebPreview
          registration={registration}
          team={team}
          event={event}
          qrCodeDataUrl={qrCodeDataUrl}
          allAccessGranted={reg.allAccessGranted}
        />
      </div>
      <p className="mt-4 text-sm text-gray-500">
        {registration.firstName} {registration.lastName} — {team.name}
      </p>
    </div>
  );
}
