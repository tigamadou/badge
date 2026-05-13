// src/components/badge/BadgeWebPreview.tsx
"use client";

import type { BadgeProps } from "@/types";

interface BadgeWebPreviewProps extends BadgeProps {
  qrCodeDataUrl: string;
  allAccessGranted?: boolean;
}

export function BadgeWebPreview({
  registration,
  team,
  event,
  qrCodeDataUrl,
  allAccessGranted = false,
}: BadgeWebPreviewProps) {
  return (
    <div
      className="relative bg-white font-sans overflow-hidden flex flex-col"
      style={{ width: "283px", height: "397px" }}
    >
      {/* En-tete : logo a gauche, titre + date a droite */}
      <div className="flex items-center px-4 pt-4 pb-2">
        {event.logo && (
          <img
            src={event.logo}
            alt="Logo"
            className="object-contain mr-2"
            style={{ width: 60, height: 60 }}
          />
        )}
        <div className="flex-1">
          <p
            className="text-[10px] font-bold leading-tight"
            style={{ color: "#1a3a7c" }}
          >
            {event.title}
          </p>
          <p className="text-[8px] mt-1" style={{ color: "#4a6fa5" }}>
            {event.location}, le {event.date}
          </p>
        </div>
      </div>

      {/* Ligne de separation bleue */}
      <div className="mx-4 mb-3" style={{ height: 2, backgroundColor: "#1a3a7c" }} />

      {/* Zone contenu blanche */}
      <div className="px-4 flex-1">
        {/* Photo | QR Code | ID vertical */}
        <div className="flex items-center mb-3">
          <div
            className="bg-gray-300 flex items-center justify-center flex-shrink-0"
            style={{ width: 80, height: 103 }}
          >
            {registration.photo ? (
              <img
                src={registration.photo}
                alt="Photo"
                className="object-cover"
                style={{ width: 80, height: 103 }}
              />
            ) : (
              <span className="text-[8px] text-gray-500">PHOTO</span>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center">
            <img
              src={qrCodeDataUrl}
              alt="QR Code"
              style={{ width: 65, height: 65 }}
            />
          </div>

          <div className="flex items-center justify-center" style={{ width: 22 }}>
            <span
              className="text-[10px] font-bold text-black text-center"
              style={{
                transform: "rotate(-90deg)",
                width: 100,
                display: "block",
              }}
            >
              {registration.id}
            </span>
          </div>
        </div>

        {/* Nom et structure */}
        <p className="text-[14px] font-bold text-black">
          {registration.firstName} {registration.lastName.toUpperCase()}
        </p>
        <p className="text-[10px] text-gray-700">{registration.structure}</p>
      </div>

      {/* Bande ALL ACCESS (conditionnelle) */}
      {allAccessGranted && (
        <div
          className="flex items-center justify-center"
          style={{ backgroundColor: "#DC2626", paddingTop: 10, paddingBottom: 10 }}
        >
          <span className="text-[20px] font-bold text-white tracking-widest">
            ALL ACCESS
          </span>
        </div>
      )}

      {/* Bande categorie/equipe tout en bas */}
      <div
        className="flex items-center justify-center"
        style={{
          backgroundColor: team.neutralBadge ? "#FFFFFF" : team.color,
          paddingTop: 14,
          paddingBottom: 14,
          ...(team.neutralBadge ? { borderTop: "1px solid #E2E8F0" } : {}),
        }}
      >
        <span
          className="text-[20px] font-bold uppercase tracking-widest"
          style={{ color: team.neutralBadge ? team.color : "#FFFFFF" }}
        >
          {team.name}
        </span>
      </div>
    </div>
  );
}
