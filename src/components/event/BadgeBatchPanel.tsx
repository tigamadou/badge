"use client";

import { useEffect, useState } from "react";
import { BadgeBatchExportV2 } from "@/components/badge/BadgeBatchExportV2";
import type { BadgeEvent, BadgeRegistration } from "@/components/badge/BadgeDocumentV2";
import { PDFViewer } from "@react-pdf/renderer";
import { generateQRCodeDataURL } from "@/lib/qrcode";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Spinner, ProgressBar } from "@/components/ui/Feedback";
import { MiniBadge } from "@/components/badge/MiniBadge";
import { Icon } from "@/components/ui/Icon";

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
  const [done, setDone] = useState(false);

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
      for (const id of ids) {
        const r = await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${id}`);
        if (!r.ok) continue;
        const j = await r.json();
        const reg = j.registration;
        const qr = await generateQRCodeDataURL(`${baseUrl}/verify/${reg.id}`);
        if (cancelled) return;
        const item: BatchItem = {
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
        };
        setItems((prev) => [...prev, item]);
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, eventId, ids, baseUrl]);

  const total = ids.length;
  const pct = total > 0 ? Math.round((items.length / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHead
          title="Génération des badges"
          subtitle={done ? "Génération terminée" : "Préparation du document PDF…"}
          action={
            done ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <Icon name="check" size={16} /> Prêt
              </span>
            ) : (
              <Spinner size={20} />
            )
          }
        />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar pct={pct} />
            </div>
            <span className="text-sm tabular-nums text-slate-500">
              {items.length} / {total}
            </span>
          </div>
          {items.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {items.map((it) => (
                <MiniBadge
                  key={it.registration.id}
                  name={
                    it.registration.category.anonymous
                      ? "Anonyme"
                      : `${it.registration.firstName} ${it.registration.lastName}`
                  }
                  category={it.registration.category.name}
                  categoryColor={it.registration.category.neutralBadge ? "#334155" : it.registration.category.color}
                  state="done"
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {event && done && items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <PDFViewer style={{ width: "100%", height: 800 }}>
            <BadgeBatchExportV2 items={items} event={event} />
          </PDFViewer>
        </div>
      )}
    </div>
  );
}
