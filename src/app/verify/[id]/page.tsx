"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatEventDate } from "@/lib/format-date";

interface VerifyData {
  valid: boolean;
  error?: string;
  registration?: {
    id: string;
    lastName: string;
    firstName: string;
    structure: string;
    photo: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED";
    team: { name: string; color: string };
  };
  event?: { title: string; location: string; date: string } | null;
}

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<VerifyData | null>(null);

  useEffect(() => {
    fetch(`/api/verify/${id}`).then((r) => r.json()).then(setData);
  }, [id]);

  if (!data) return <p className="text-center mt-20">Vérification en cours...</p>;

  if (!data.registration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <div className="text-6xl mb-4">&#10060;</div>
          <h1 className="text-2xl font-bold text-red-700">Badge invalide</h1>
          <p className="text-gray-600 mt-2">Ce badge n&apos;existe pas dans le système.</p>
        </div>
      </div>
    );
  }

  const reg = data.registration;
  const bgColor = data.valid ? "bg-green-50" : "bg-red-50";

  return (
    <div className={`min-h-screen flex items-center justify-center ${bgColor}`}>
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">{data.valid ? "\u2705" : "\u274C"}</div>
        <h1 className={`text-xl font-bold mb-4 ${data.valid ? "text-green-700" : "text-red-700"}`}>
          {data.valid ? "Badge valide" : "Badge non valide"}
        </h1>

        {reg.photo && (
          <img
            src={`/api/files/${reg.photo}`}
            alt="Photo"
            className="w-24 h-32 object-cover rounded mx-auto mb-4"
          />
        )}

        <p className="text-lg font-semibold">{reg.lastName} {reg.firstName}</p>
        <p className="text-gray-600">{reg.structure}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: reg.team.color }} />
          <span className="font-medium">{reg.team.name}</span>
        </div>
        <div className="mt-3">
          <StatusBadge status={reg.status} />
        </div>

        {data.event && (
          <p className="text-xs text-gray-400 mt-4">
            {data.event.title} — {data.event.location}, {formatEventDate(data.event.date)}
          </p>
        )}

        <p className="text-xs text-gray-300 mt-2 font-mono">{reg.id}</p>
      </div>
    </div>
  );
}
