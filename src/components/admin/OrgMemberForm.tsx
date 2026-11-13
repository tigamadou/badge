"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { RoleSelect } from "@/components/permissions/RoleSelect";
import { defaultRoleId, readOrThrow } from "@/components/permissions/logic";
import type { AssignableRoleRow } from "@/components/permissions/types";

export function OrgMemberForm({ orgId, onAdded, roles }: { orgId: string; onAdded: () => void; roles: AssignableRoleRow[] }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState(() => defaultRoleId(roles, "MANAGER"));

  const invite = useAsyncAction(
    async () => {
      const res = await fetch(`/api/org/${orgId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, roleId }),
      });
      await readOrThrow(res);
    },
    {
      success: "Invitation envoyée.",
      error: "Échec de l'invitation.",
      onSuccess: () => {
        setEmail("");
        setName("");
        setRoleId(defaultRoleId(roles, "MANAGER"));
        onAdded();
      },
    },
  );

  return (
    <Card>
      <CardHead title="Inviter un membre" subtitle="Un e-mail d'invitation sera envoyé au rôle choisi." />
      <CardBody>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void invite.run();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input
              type="email"
              placeholder="email@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <RoleSelect name="roleId" roles={roles} value={roleId} onChange={setRoleId} />
          <Button type="submit" loading={invite.pending} disabled={!roleId}>
            <span className="inline-flex items-center gap-2">
              <Icon name="send" size={16} /> Inviter
            </span>
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
