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
      className="relative bg-white font-sans overflow-hidden"
      style={{ width: "283px", height: "397px" }}
    >
      {/* En-tete blanc : Logo + Titre + Date */}
      <div
        className="flex flex-col items-center justify-center px-4"
        style={{ height: allAccessGranted ? "35%" : "38%" }}
      >
        {event.logo && (
          <img
            src={event.logo}
            alt="Logo"
            className="object-contain mb-1"
            style={{ width: 80, height: 80 }}
          />
        )}
        <p className="text-[10px] font-bold text-center leading-tight" style={{ color: "#1a3a7c" }}>
          {event.title}
        </p>
        <p className="text-[9px] mt-1 text-center" style={{ color: "#4a6fa5" }}>
          {event.location}, le {event.date}
        </p>
      </div>

      {/* Zone centrale coloree */}
      <div
        className="flex flex-col"
        style={{
          backgroundColor: team.color,
          height: allAccessGranted ? "53%" : "62%",
        }}
      >
        {/* Nom de la categorie */}
        <div className="py-3 flex items-center justify-center">
          <span className="text-[26px] font-bold text-white uppercase tracking-widest">
            {team.name}
          </span>
        </div>

        {/* Contenu : ID + Photo + Infos */}
        <div className="flex flex-1">
          {/* ID vertical */}
          <div className="flex items-center justify-center" style={{ width: 22 }}>
            <span
              className="text-[7px] text-white text-center"
              style={{
                transform: "rotate(-90deg)",
                width: 120,
                display: "block",
              }}
            >
              {registration.id}
            </span>
          </div>

          {/* Photo */}
          <div
            className="bg-gray-300 flex items-center justify-center"
            style={{ width: 90, height: 105 }}
          >
            {registration.photo ? (
              <img
                src={registration.photo}
                alt="Photo"
                className="object-cover"
                style={{ width: 90, height: 105 }}
              />
            ) : (
              <span className="text-[8px] text-gray-500">PHOTO</span>
            )}
          </div>

          {/* Nom + Structure */}
          <div className="flex-1 flex flex-col justify-center px-3">
            <p className="text-[13px] font-bold text-white">
              {registration.firstName[0]}. {registration.lastName}
            </p>
            <div className="w-10 h-px bg-white my-1.5" />
            <p className="text-[10px] text-white">{registration.structure}</p>
          </div>
        </div>

        {/* QR Code en bas a droite */}
        <div className="flex justify-end pr-2 pb-2">
          <img
            src={qrCodeDataUrl}
            alt="QR Code"
            style={{ width: 55, height: 55 }}
          />
        </div>
      </div>

      {/* Bande ALL ACCESS */}
      {allAccessGranted && (
        <div
          className="flex items-center justify-center"
          style={{ height: "12%", backgroundColor: "#DC2626" }}
        >
          <span className="text-[24px] font-bold text-white tracking-widest">
            ALL ACCESS
          </span>
        </div>
      )}
    </div>
  );
}
