"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "@/components/ui/Labels";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { Permission } from "@/lib/permissions/catalog";
import {
  effectiveSet,
  overridesToRows,
  readOrThrow,
  toggleOverride,
} from "./logic";
import { PermissionSpaces, SwitchCells } from "./PermissionSpaces";
import type { MatrixLevels, OverrideEffect, PermissionLevelRow } from "./types";

type Props = {
  /** Niveaux à éditer (plateforme et/ou organisations), tels que renvoyés par l'API d'ajustements. */
  levels: PermissionLevelRow[];
  /** Point d'accès : GET/PUT `{ orgId, overrides }` (plateforme) ou `{ overrides }` (organisation). */
  endpoint: string;
  /** Permissions détenues par l'acteur sur la cible ; les autres ne sont pas « ajoutables ». */
  heldPermissions: Permission[];
  /** Niveaux de permission portés par la cible (plateforme : tous ; organisation : ORG et EVENT). */
  scopes: MatrixLevels;
  /** Le corps du PUT contient `orgId` (route plateforme) ou non (route d'organisation). */
  sendOrgId: boolean;
};

function LevelEditor({ level, endpoint, heldPermissions, scopes, sendOrgId }: Props & { level: PermissionLevelRow }) {
  const router = useRouter();
  const orgId = level.target.kind === "org" ? level.target.orgId : null;
  const inherited = useMemo(() => new Set(level.inherited), [level.inherited]);
  const held = useMemo(() => new Set(heldPermissions), [heldPermissions]);
  const [overrides, setOverrides] = useState<Map<Permission, OverrideEffect>>(
    () => new Map(level.overrides.map((o) => [o.permission, o.effect])),
  );
  const effective = useMemo(() => effectiveSet(inherited, overrides), [inherited, overrides]);

  const { run, pending } = useAsyncAction(
    async () => {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...(sendOrgId ? { orgId } : {}), overrides: overridesToRows(overrides) }),
      });
      await readOrThrow(res);
    },
    { success: "Permissions enregistrées.", onSuccess: () => router.refresh() },
  );

  return (
    <section className="space-y-4" aria-label={levelName(level)}>
      <p className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
        Rôle {level.target.kind === "org" ? "dans l'organisation" : "sur la plateforme"} :
        {level.role ? <RoleBadge tone="slate">{level.role.name}</RoleBadge> : <span className="text-slate-400">aucun</span>}
      </p>
      <PermissionSpaces
        levels={scopes}
        isActive={(key) => effective.has(key)}
        renderRow={(def) => {
          const key = def.key as Permission;
          const on = effective.has(key);
          // Activer une permission que le rôle n'accorde pas exige de la détenir soi-même.
          const reason = !on && !inherited.has(key) && !held.has(key) ? "Vous ne détenez pas cette permission." : undefined;
          return (
            <SwitchCells
              def={def}
              checked={on}
              locked={reason !== undefined}
              reason={reason}
              idPrefix={levelId(level)}
              onToggle={() => setOverrides(toggleOverride(inherited, overrides, key))}
            />
          );
        }}
      />
      <Button loading={pending} onClick={() => void run()}>
        Enregistrer
      </Button>
    </section>
  );
}

const levelName = (level: PermissionLevelRow) => (level.target.kind === "org" ? level.target.orgName : "Plateforme");
const levelId = (level: PermissionLevelRow) => (level.target.kind === "org" ? level.target.orgId : "platform");

export function UserPermissionsEditor(props: Props) {
  return (
    <div className="space-y-10" data-testid="user-permissions-editor">
      {props.levels.map((level) => (
        <LevelEditor key={levelId(level)} {...props} level={level} />
      ))}
    </div>
  );
}
