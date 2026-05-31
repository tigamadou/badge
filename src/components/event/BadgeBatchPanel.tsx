"use client";

import { useEffect, useState } from "react";
import { BadgeBatchExportV2 } from "@/components/badge/BadgeBatchExportV2";
import type { BadgeEvent, BadgeRegistration } from "@/components/badge/BadgeDocumentV2";
import { PDFViewer } from "@react-pdf/renderer";
import { generateQRCodeDataURL } from "@/lib/qrcode";

type BatchItem = { registration: BadgeRegistration; qrDataUrl: string };

export function BadgeBatchPanel({
  orgId,
  eventId,
  ids,
  baseUrl,
}: {
  orgId: string;
  eventId: string;
  ids: string[];
  baseUrl: string;
}) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [event, setEvent] = useState<BadgeEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const evtRes = await fetch(`/api/admin/${orgId}/events/${eventId}`);
      if (!evtRes.ok) return;
      const evtJson = await evtRes.json();
      if (cancelled) return;
      setEvent({
        title: evtJson.event.title,
        date: new Date(evtJson.event.date),
        logo: evtJson.event.logo ?? null,
      });
      const fetched: BatchItem[] = [];
      for (const id of ids) {
        const r = await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${id}`);
        if (!r.ok) continue;
        const j = await r.json();
        const reg = j.registration;
        const qr = await generateQRCodeDataURL(`${baseUrl}/verify/${reg.id}`);
        fetched.push({
          registration: {
            id: reg.id,
            firstName: reg.firstName,
            lastName: reg.lastName,
            structure: reg.structure,
            photo: reg.photo,
            allAccessGranted: reg.allAccessGranted,
            category: {
              name: reg.category.name,
              color: reg.category.color,
              number: reg.category.number,
              neutralBadge: reg.category.neutralBadge,
              anonymous: reg.category.anonymous,
            },
          },
          qrDataUrl: qr,
        });
      }
      if (!cancelled) setItems(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, eventId, ids, baseUrl]);

  if (!event || items.length === 0) return <div className="text-sm text-gray-500">Chargement...</div>;

  return (
    <PDFViewer style={{ width: "100%", height: 800 }}>
      <BadgeBatchExportV2 items={items} event={event} />
    </PDFViewer>
  );
}
