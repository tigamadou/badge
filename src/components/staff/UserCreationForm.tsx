"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { FormSection } from "@/components/ui/FormControls";
import { RadioCards } from "@/components/ui/RadioCards";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

type OrgLite = { id: string; name: string };

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

const SELECT_CLASS =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500";

export function UserCreationForm({
  orgs,
  canCreateStaff,
  canCreateTopStaff,
}: {
  orgs: OrgLite[];
  canCreateStaff: boolean;
  canCreateTopStaff: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    name: "",
    type: "client" as "client" | "staff",
    staffRole: "STAFF_OBSERVER" as StaffRoleStr,
    orgId: "",
    orgRole: "OWNER" as "OWNER" | "MANAGER" | "AUDITOR",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const payload: Record<string, unknown> = {
      email: form.email.trim(),
      name: form.name.trim(),
      type: form.type,
    };
    if (form.type === "staff") payload.staffRole = form.staffRole;
    if (form.type === "client" && form.orgId) {
      payload.orgId = form.orgId;
      payload.orgRole = form.orgRole;
    }

    const res = await fetch("/api/platform/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      const json = await res.json();
      router.push(`/platform/users/${json.user.id}`);
    } else if (res.status === 409) {
      setMsg("E-mail déjà utilisé.");
    } else {
      const json = await res.json().catch(() => ({}));
      setMsg(json.error ?? "Erreur à la création.");
    }
  }

  const typeOptions = [
    { value: "client", title: "Client", description: "Rattaché à une organisation.", color: "#16a34a" },
    ...(canCreateStaff
      ? [{ value: "staff", title: "Staff applicatif", description: "Administration de la plateforme.", color: "#004D74" }]
      : []),
  ];

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      {msg && (
        <Alert tone="err">
          <Icon name="alert-triangle" size={16} /> {msg}
        </Alert>
      )}

      <Card>
        <div className="px-6">
          <FormSection title="Compte">
            <div className="space-y-4">
              <Input
                label="Adresse e-mail"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Nom complet"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
          </FormSection>

          <FormSection title="Type de compte">
            <RadioCards
              name="Type de compte"
              value={form.type}
              onChange={(v) => setForm((f) => ({ ...f, type: v as "client" | "staff" }))}
              options={typeOptions}
            />
          </FormSection>

          {form.type === "staff" && canCreateStaff && (
            <FormSection title="Rôle staff">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Rôle</span>
                <select
                  value={form.staffRole}
                  onChange={(e) => setForm((f) => ({ ...f, staffRole: e.target.value as StaffRoleStr }))}
                  className={SELECT_CLASS}
                >
                  <option value="STAFF_OBSERVER">STAFF_OBSERVER</option>
                  <option value="STAFF_SUPPORT">STAFF_SUPPORT</option>
                  {canCreateTopStaff && <option value="STAFF_ADMIN">STAFF_ADMIN</option>}
                  {canCreateTopStaff && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
                </select>
              </label>
            </FormSection>
          )}

          {form.type === "client" && (
            <FormSection title="Lier à une organisation (optionnel)">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Organisation</span>
                  <select
                    value={form.orgId}
                    onChange={(e) => setForm((f) => ({ ...f, orgId: e.target.value }))}
                    className={SELECT_CLASS}
                  >
                    <option value="">Aucune</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                {form.orgId && (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Rôle dans l&apos;organisation</span>
                    <select
                      value={form.orgRole}
                      onChange={(e) => setForm((f) => ({ ...f, orgRole: e.target.value as typeof form.orgRole }))}
                      className={SELECT_CLASS}
                    >
                      <option value="OWNER">OWNER</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="AUDITOR">AUDITOR</option>
                    </select>
                  </label>
                )}
              </div>
            </FormSection>
          )}
        </div>
        <CardBody className="border-t border-slate-100 text-[13px] text-slate-400">
          L&apos;utilisateur recevra un e-mail avec un lien setup-password valable 24 h.
        </CardBody>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.push("/platform/users")}>
          Annuler
        </Button>
        <Button
          type="submit"
          className="flex items-center justify-center gap-2"
          disabled={busy || !form.email.trim() || !form.name.trim()}
        >
          {busy ? (
            <>
              <Spinner size={16} /> Création…
            </>
          ) : (
            "Créer et inviter"
          )}
        </Button>
      </div>
    </form>
  );
}
