"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResubmitButton({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/account/registrations/${registrationId}/resubmit`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Resoumission impossible.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center bg-green-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
      >
        {loading ? "Resoumission..." : "Resoumettre mon inscription"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
