"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { ROLE_SCOPE_ALLOWS, type RoleScope } from "@/lib/permissions/system-roles";
import type { Permission } from "@/lib/permissions/catalog";
import { editablePermissions, readOrThrow } from "./logic";
import { PermissionMatrix } from "./PermissionMatrix";
import type { RoleRow } from "./types";

type Props = {
  mode: "create" | "edit" | "duplicate";
  scope: Exclude<RoleScope, "PARTICIPANT">;
  initial?: Pick<RoleRow, "id" | "name" | "description" | "permissions">;
  /** Racine de l'API, par exemple `/api/platform/roles` ou `/api/org/<id>/roles`. */
  apiBase: string;
  /** Permissions détenues par l'acteur : les autres ne sont pas cochables. */
  heldPermissions: Permission[];
  redirectTo: string;
  /** Les routes d'organisation exigent la portée du rôle dans le corps ; la route plateforme la refuse. */
  sendScope?: boolean;
};

const TITLES = { create: "Créer le rôle", edit: "Enregistrer", duplicate: "Créer la copie" } as const;

export function RoleEditor({ mode, scope, initial, apiBase, heldPermissions, redirectTo, sendScope = false }: Props) {
  const router = useRouter();
  const [name, setName] = useState(mode === "duplicate" && initial ? `${initial.name} (copie)` : (initial?.name ?? ""));
  const [description, setDescription] = useState(initial?.description ?? "");
  // Une copie ne reprend que ce que l'acteur peut accorder ; les clés réservées n'en font jamais partie.
  const [selected, setSelected] = useState<Set<Permission>>(() => {
    const editable = new Set(editablePermissions(ROLE_SCOPE_ALLOWS[scope]));
    const held = new Set(heldPermissions);
    return new Set((initial?.permissions ?? []).filter((p) => editable.has(p) && (mode === "edit" || held.has(p))));
  });

  // Les permissions déjà portées par le rôle en édition restent décochables même si l'acteur ne les détient pas.
  const disabled = useMemo(() => {
    const held = new Set(heldPermissions);
    const keep = new Set(mode === "edit" ? initial?.permissions : []);
    const map = new Map<Permission, string>();
    for (const key of editablePermissions(ROLE_SCOPE_ALLOWS[scope])) {
      if (!held.has(key) && !keep.has(key)) map.set(key, "Vous ne détenez pas cette permission.");
    }
    return map;
  }, [heldPermissions, initial, mode, scope]);

  const { run, pending } = useAsyncAction(
    async () => {
      const body = {
        name: name.trim(),
        description: description.trim() === "" ? null : description.trim(),
        permissions: [...selected],
        ...(mode !== "edit" && sendScope ? { scope } : {}),
      };
      const res = await fetch(mode === "edit" ? `${apiBase}/${initial!.id}` : apiBase, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      await readOrThrow(res);
    },
    {
      success: mode === "edit" ? "Rôle enregistré." : "Rôle créé.",
      onSuccess: () => {
        router.push(redirectTo);
        router.refresh();
      },
    },
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Nom du rôle" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} required />
        <Input
          label="Description (facultative)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
      </div>
      <PermissionMatrix
        levels={ROLE_SCOPE_ALLOWS[scope]}
        selected={selected}
        onChange={setSelected}
        disabled={disabled}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending} disabled={name.trim().length < 2}>
          {TITLES[mode]}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push(redirectTo)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
