"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { BadgeDocument } from "./BadgeDocument";
import { generateQRCodeDataURL } from "@/lib/qrcode";
import { formatEventDate } from "@/lib/format-date";
import type { EventInfo } from "@/types";

interface RegistrationData {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  structure: string;
  photo: string | null;
  idDocumentType: string;
  idDocumentNumber: string;
  idDocument: string | null;
  status: string;
  allAccessGranted: boolean;
  team: { id: string; name: string; color: string; number: number };
}

interface EventData {
  id: string;
  title: string;
  location: string;
  date: string;
  logo: string | null;
}

interface BadgeBatchExportProps {
  registrations: RegistrationData[];
  event: EventData;
  label: string;
}

export function BadgeBatchExport({ registrations, event, label }: BadgeBatchExportProps) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  async function handleExport() {
    if (registrations.length === 0 || exporting) return;

    setExporting(true);
    setProgress({ current: 0, total: registrations.length });

    const zip = new JSZip();

    const badgeEvent: EventInfo = {
      id: event.id,
      title: event.title,
      location: event.location,
      date: formatEventDate(event.date),
      logo: event.logo ? `/api/files/${event.logo}` : "",
    };

    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      setProgress({ current: i + 1, total: registrations.length });

      try {
        const qrCodeDataUrl = await generateQRCodeDataURL(reg.id);

        const badgeRegistration = {
          id: reg.id,
          lastName: reg.lastName,
          firstName: reg.firstName,
          structure: reg.structure,
          photo: reg.photo ? `/api/files/${reg.photo}` : "",
          email: reg.email,
          idDocumentType: reg.idDocumentType,
          idDocumentNumber: reg.idDocumentNumber,
          idDocument: reg.idDocument || "",
          teamId: reg.team.id,
          status: reg.status as "PENDING" | "APPROVED" | "REJECTED",
          allAccessGranted: reg.allAccessGranted,
        };

        const blob = await pdf(
          <BadgeDocument
            registration={badgeRegistration}
            team={reg.team}
            event={badgeEvent}
            qrCodeDataUrl={qrCodeDataUrl}
            allAccessGranted={reg.allAccessGranted}
          />
        ).toBlob();

        const fileName = `badge-${reg.lastName}-${reg.firstName}-${reg.id}.pdf`.replace(/\s+/g, "-");
        zip.file(fileName, blob);
      } catch (err) {
        console.error(`Erreur generation badge ${reg.id}:`, err);
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const today = new Date().toISOString().slice(0, 10);
    saveAs(zipBlob, `badges-export-${today}.zip`);

    setExporting(false);
    setProgress({ current: 0, total: 0 });
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting || registrations.length === 0}
      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {exporting
        ? `Generation ${progress.current}/${progress.total}...`
        : label}
    </button>
  );
}
