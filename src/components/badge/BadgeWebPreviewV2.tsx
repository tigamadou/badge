"use client";

import type { BadgeRegistration, BadgeEvent } from "./BadgeDocumentV2";

export function BadgeWebPreviewV2({
  registration,
  event,
  photoUrl,
  logoUrl,
  qrDataUrl,
}: {
  registration: BadgeRegistration;
  event: BadgeEvent;
  photoUrl?: string | null;
  logoUrl?: string | null;
  qrDataUrl?: string;
}) {
  const catColor = registration.category.neutralBadge ? "#777" : registration.category.color;
  return (
    <div className="bg-white border rounded-lg overflow-hidden w-[220px] shadow">
      <div className="flex items-center gap-3 p-3 border-b">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="w-10 h-10 object-contain" />
        )}
        <div className="text-xs">
          <div className="font-bold">{event.title}</div>
          <div className="text-slate-500">{new Date(event.date).toLocaleDateString("fr-FR")}</div>
        </div>
      </div>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-slate-100" />
      )}
      <div className="p-2 text-center">
        <div className="font-semibold text-sm">
          {registration.firstName} {registration.lastName}
        </div>
        <div className="text-xs text-slate-600">{registration.structure}</div>
      </div>
      <div className="p-2 text-white text-center text-sm font-semibold" style={{ background: catColor }}>
        #{registration.category.number} — {registration.category.name}
        {registration.allAccessGranted ? " — ALL ACCESS" : ""}
      </div>
      <div className="flex justify-between items-center p-2 border-t">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="" className="w-12 h-12" />
        ) : (
          <span className="text-xs text-slate-400">QR</span>
        )}
        <span className="text-[10px] text-slate-500">{registration.id}</span>
      </div>
    </div>
  );
}
