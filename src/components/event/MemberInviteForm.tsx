"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { RoleSelect } from "@/components/permissions/RoleSelect";
import { defaultRoleId } from "@/components/permissions/logic";
import type { AssignableRoleRow } from "@/components/permissions/types";

export function MemberInviteForm({
  orgId,
  eventId,
  roles,
  onDone,
  onCancel,
}: {
  orgId: string;
  eventId: string;
  roles: AssignableRoleRow[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState(() => defaultRoleId(roles, "OPERATOR"));
  const [emailError, setEmailError] = useState<string | null>(null);

  // Motif C : ALREADY_MEMBER est rattaché au champ e-mail ; le reste lève une exception (toast).
  const invite = useAsyncAction(
    async (): Promise<{ emailError?: string }> => {
      const res = await fetch(`/api/org/${orgId}/events/${eventId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined, roleId }),
      });
      if (!res.ok) {
        const j = await res.clone().json().catch(() => ({}));
        if (j.code === "ALREADY_MEMBER") {
          return { emailError: "Cet utilisateur est déjà membre de l'événement." };
        }
        throw res;
      }
      return {};
    },
    {
      error: "Échec de l'invitation.",
      // Le toast est global : il survit à la fermeture de la modale par onDone.
      onSuccess: (result) => {
        if (result.emailError) {
          setEmailError(result.emailError);
          return;
        }
        toastSuccess("Invitation envoyée.");
        onDone();
      },
    },
  );
  const busy = invite.pending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setEmailError(null);
        void invite.run();
      }}
      className="bg-white border rounded p-4 space-y-3">
      <h3 className="font-semibold">Inviter un membre</h3>
      <Input
        type="email"
        placeholder="Email"
        value={email}
        error={emailError ?? undefined}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        placeholder="Nom (optionnel si l'utilisateur existe)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <RoleSelect name="roleId" roles={roles} value={roleId} onChange={setRoleId} />
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" type="button" onClick={onCancel} disabled={busy}>
          Annuler
        </Button>
        <Button type="submit" loading={busy} disabled={!roleId}>
          Inviter
        </Button>
      </div>
    </form>
  );
}
