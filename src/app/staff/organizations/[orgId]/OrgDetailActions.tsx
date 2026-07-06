"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

export function OrgDetailActions({
  org,
  canDelete,
}: {
  org: { id: string; slug: string; archived: boolean };
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");

  async function archive() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/organizations/${org.id}/archive`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      setMsg("Organisation archivée.");
      router.refresh();
    } else {
      setMsg("Échec de l'archivage.");
    }
  }

  async function restore() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/organizations/${org.id}/restore`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      setMsg("Organisation restaurée.");
      router.refresh();
    } else {
      setMsg("Échec de la restauration.");
    }
  }

  async function destroy() {
    if (confirmSlug !== org.slug) {
      setMsg("Confirmation invalide : saisissez le slug exact.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/staff/organizations/${org.id}`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        "x-confirm": `delete-${org.slug}`,
      },
      body: JSON.stringify({ confirmSlug: org.slug }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/staff/organizations");
    } else {
      setConfirmOpen(false);
      setMsg("Échec de la suppression.");
    }
  }

  return (
    <Card className="border-rose-200">
      <CardHead title="Zone de danger" />
      <CardBody className="space-y-4">
        {msg && <Alert tone="info">{msg}</Alert>}
        <div className="flex flex-wrap gap-3">
          {!org.archived ? (
            <Button variant="secondary" onClick={archive} disabled={busy}>
              Archiver
            </Button>
          ) : (
            <Button variant="secondary" onClick={restore} disabled={busy}>
              Restaurer
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={busy}>
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
        }}
        onConfirm={destroy}
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
          />
        </div>
      </Modal>
    </Card>
  );
}
