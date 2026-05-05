// src/components/badge/BadgeWebPreview.tsx
"use client";

import Image from "next/image";
import type { BadgeProps } from "@/types";

interface BadgeWebPreviewProps extends BadgeProps {
  qrCodeDataUrl: string;
}

export function BadgeWebPreview({
  registration,
  team,
  event,
  qrCodeDataUrl,
}: BadgeWebPreviewProps) {
  return (
    <div
      className="relative bg-white font-sans"
      style={{ width: "283px", height: "397px" }}
    >
      {/* En-tête : Logo + Infos événement + QR code */}
      <div
        className="flex flex-col items-center justify-center px-4 pt-4 pb-4"
        style={{ height: "50%" }}
      >
        <div className="flex items-center gap-3 px-4 pt-4">
          {event.logo && (
            <img
              src={event.logo}
              alt="Logo"
              className="object-contain"
              style={{ width: 70, height: 70 }}
            />
          )}
          <div className="text-center">
            <p className="text-[10px] font-bold leading-tight">
              {event.title}
            </p>
            <p className="text-[9px] mt-1">
              {event.location}, le {event.date}
            </p>
          </div>
        </div>
        <img
          src={qrCodeDataUrl}
          alt="QR Code"
          style={{ width: 70, height: 70 }}
        />
      </div>

      {/* Zone centrale */}
      <div
        className="flex flex-1"
        style={{ backgroundColor: team.color }}
      >
        {/* ID vertical */}
        <div className="flex items-center justify-center" style={{ width: 20 }}>
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

        <div className="flex flex-1">
          {/* Photo */}
          <div
            className="bg-gray-300 flex items-center justify-center -mt-[50px]"
            style={{ width: 90, height: 100 }}
          >
            {registration.photo ? (
              <img
                src={registration.photo}
                alt="Photo"
                className="object-cover"
                style={{ width: 90, height: 100 }}
              />
            ) : (
              <span className="text-[8px] text-gray-500">PHOTO</span>
            )}
          </div>

          {/* Nom + Structure */}
          <div className="flex-1 flex flex-col justify-center px-3">
            <p className="text-xs font-bold text-white">
              {registration.lastName} {registration.firstName}
            </p>
            <div className="w-10 h-px bg-white my-1.5" />
            <p className="text-[10px] text-white">{registration.structure}</p>
          </div>
        </div>
      </div>

      {/* Bandeau équipe */}
      <div
        className="flex items-center justify-center"
        style={{ height: 60, backgroundColor: team.color }}
      >
        <span className="text-[22px] font-bold text-white uppercase tracking-widest">
          {team.name}
        </span>
      </div>
    </div>
  );
}
