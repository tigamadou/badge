"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Icon } from "@/components/ui/Icon";

export function OrgDetailActions({
  org,
  canDelete,
}: {
  org: { id: string; slug: string; archived: boolean };
  canDelete: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const archive = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/organizations/${org.id}/archive`, { method: "POST" });
      if (!res.ok) throw res;
    },
    { success: "Organisation archivée.", error: "Échec de l'archivage.", onSuccess: () => router.refresh() },
  );

  const restore = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/organizations/${org.id}/restore`, { method: "POST" });
      if (!res.ok) throw res;
    },
    { success: "Organisation restaurée.", error: "Échec de la restauration.", onSuccess: () => router.refresh() },
  );

  const destroy = useAsyncAction(
    async () => {
      const res = await fetch(`/api/platform/organizations/${org.id}`, {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          "x-confirm": `delete-${org.slug}`,
        },
        body: JSON.stringify({ confirmSlug: org.slug }),
      });
      if (!res.ok) {
        setConfirmOpen(false);
        throw res;
      }
    },
    {
      // Le toast survit à la navigation : le Toaster vit dans le layout racine.
      success: "Organisation supprimée.",
      error: "Échec de la suppression.",
      onSuccess: () => {
        setNavigating(true);
        router.push("/platform/organizations");
      },
    },
  );

  function confirmDestroy() {
    if (confirmSlug !== org.slug) {
      setSlugError("Confirmation invalide : saisissez le slug exact.");
      return;
    }
    setSlugError(null);
    void destroy.run();
  }

  return (
    <Card className="border-rose-200">
      <CardHead title="Zone de danger" />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {!org.archived ? (
            <Button variant="secondary" onClick={archive.run} loading={archive.pending} disabled={restore.pending}>
              Archiver
            </Button>
          ) : (
            <Button variant="secondary" onClick={restore.run} loading={restore.pending} disabled={archive.pending}>
              Restaurer
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={archive.pending || restore.pending}>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="trash-2" size={16} /> Supprimer définitivement
              </span>
            </Button>
          )}
        </div>
        {!canDelete && (
          <p className="text-xs text-slate-400">La suppression définitive est réservée aux SUPER_ADMIN.</p>
        )}
      </CardBody>

      <Modal
        open={confirmOpen}
        title="Supprimer définitivement l'organisation"
        confirmLabel="Supprimer définitivement"
        confirmVariant="danger"
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmSlug("");
          setSlugError(null);
        }}
        onConfirm={confirmDestroy}
        confirmLoading={destroy.pending || navigating}
      >
        <div className="space-y-3">
          <p>
            Cette action est <b>irréversible</b>. Pour confirmer, saisissez le slug de l&apos;organisation :{" "}
            <code className="font-mono text-slate-900">{org.slug}</code>
          </p>
          <Input
            label="Slug de confirmation"
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            placeholder={org.slug}
            error={slugError ?? undefined}
          />
        </div>
      </Modal>
    </Card>
  );
}
