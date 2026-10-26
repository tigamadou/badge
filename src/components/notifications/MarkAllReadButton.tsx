"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { scopeToSearchParams, type NotificationScopeRef } from "@/lib/notifications/scope";

export function MarkAllReadButton({ scope }: { scope: NotificationScopeRef }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markAll() {
    setLoading(true);
    try {
      await fetch(`/api/notifications/read-all?${scopeToSearchParams(scope).toString()}`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="secondary" loading={loading} onClick={markAll}>
      Tout marquer comme lu
    </Button>
  );
}
