"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { FormSection } from "@/components/ui/FormControls";
import { RadioCards } from "@/components/ui/RadioCards";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { RoleSelect } from "@/components/permissions/RoleSelect";
import { defaultRoleId } from "@/components/permissions/logic";
import type { AssignableRoleRow } from "@/components/permissions/types";

type OrgLite = { id: string; name: string };

const SELECT_CLASS =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-navy";

export function UserCreationForm({
  orgs,
  canCreateStaff,
  canCreateClient,
  platformRoles,
  orgRoles,
}: {
  orgs: OrgLite[];
  canCreateStaff: boolean;
  canCreateClient: boolean;
  // Rôles plateforme attribuables par l'acteur (précalculés par la page).
  platformRoles: AssignableRoleRow[];
  // Rôles d'organisation système attribuables ; ceux d'une organisation précise sont relus à son choix.
  orgRoles: AssignableRoleRow[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    name: "",
    type: (canCreateClient ? "client" : "staff") as "client" | "staff",
    platformRoleId: defaultRoleId(platformRoles, "STAFF_OBSERVER"),
    orgId: "",
    orgRoleId: defaultRoleId(orgRoles, "OWNER"),
  });
  // Rôles de l'organisation choisie (système + personnalisés), relus à chaque changement d'organisation.
  const [orgChoices, setOrgChoices] = useState<AssignableRoleRow[]>(orgRoles);
  const [rolesLoading, setRolesLoading] = useState(false);

  async function pickOrg(orgId: string) {
    setForm((f) => ({ ...f, orgId }));
    if (!orgId) return;
    setRolesLoading(true);
    try {
      const res = await fetch(`/api/platform/roles/assignable?scope=ORG&orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const roles = ((await res.json()) as { roles: AssignableRoleRow[] }).roles;
        setOrgChoices(roles);
        setForm((f) => (roles.some((r) => r.id === f.orgRoleId && r.assignable) ? f : { ...f, orgRoleId: defaultRoleId(roles, "OWNER") }));
      }
    } finally {
      setRolesLoading(false);
    }
  }
  const [emailError, setEmailError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const create = useAsyncAction(
    async (): Promise<{ id?: string; emailError?: string }> => {
      const payload: Record<string, unknown> = {
        email: form.email.trim(),
        name: form.name.trim(),
        type: form.type,
      };
      if (form.type === "staff") payload.platformRoleId = form.platformRoleId;
      if (form.type === "client" && form.orgId) {
        payload.orgId = form.orgId;
        payload.orgRoleId = form.orgRoleId;
      }

      const res = await fetch("/api/platform/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) return { emailError: "E-mail déjà utilisé." };
      if (!res.ok) throw res;
      const json = await res.json();
      return { id: json.user.id as string };
    },
    {
      error: "Erreur à la création.",
      onSuccess: (result) => {
        if (result.emailError) {
          setEmailError(result.emailError);
          return;
        }
        setNavigating(true);
        router.push(`/platform/users/${result.id}`);
      },
    },
  );
  const busy = create.pending || navigating;

  const typeOptions = [
    ...(canCreateClient
      ? [{ value: "client", title: "Client", description: "Rattaché à une organisation.", color: "#16B8A6" }]
      : []),
    ...(canCreateStaff
      ? [{ value: "staff", title: "Staff applicatif", description: "Administration de la plateforme.", color: "#081558" }]
      : []),
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setEmailError(null);
        void create.run();
      }}
      className="max-w-2xl space-y-4"
    >
      <Card>
        <div className="px-6">
          <FormSection title="Compte">
            <div className="space-y-4">
              <Input
                label="Adresse e-mail"
                type="email"
                required
                value={form.email}
                error={emailError ?? undefined}
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
              <RoleSelect
                name="platformRoleId"
                roles={platformRoles}
                value={form.platformRoleId}
                onChange={(v) => setForm((f) => ({ ...f, platformRoleId: v }))}
              />
            </FormSection>
          )}

          {form.type === "client" && (
            <FormSection title="Lier à une organisation (optionnel)">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Organisation</span>
                  <select
                    value={form.orgId}
                    onChange={(e) => void pickOrg(e.target.value)}
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
                  <RoleSelect
                    name="orgRoleId"
                    label="Rôle dans l'organisation"
                    roles={orgChoices}
                    value={form.orgRoleId}
                    disabled={rolesLoading}
                    onChange={(v) => setForm((f) => ({ ...f, orgRoleId: v }))}
                  />
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
        <Button type="submit" loading={busy} disabled={!form.email.trim() || !form.name.trim() || (form.type === "staff" && !form.platformRoleId)}>
          Créer et inviter
        </Button>
      </div>
    </form>
  );
}
