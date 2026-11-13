"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "@/components/ui/Labels";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { Permission } from "@/lib/permissions/catalog";
import {
  effectiveSet,
  groupedPermissions,
  overridesToRows,
  readOrThrow,
  setOverrideState,
  stateOf,
  type OverrideState,
} from "./logic";
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

const STATE_LABELS: Record<OverrideState, string> = { inherited: "Hérité", granted: "Ajouté", revoked: "Retiré" };

function LevelEditor({ level, endpoint, heldPermissions, scopes, sendOrgId }: Props & { level: PermissionLevelRow }) {
  const router = useRouter();
  const orgId = level.target.kind === "org" ? level.target.orgId : null;
  const inherited = useMemo(() => new Set(level.inherited), [level.inherited]);
  const held = useMemo(() => new Set(heldPermissions), [heldPermissions]);
  const [overrides, setOverrides] = useState<Map<Permission, OverrideEffect>>(
    () => new Map(level.overrides.map((o) => [o.permission, o.effect])),
  );
  const effective = useMemo(() => effectiveSet(inherited, overrides), [inherited, overrides]);
  const groups = useMemo(() => groupedPermissions(scopes), [scopes]);

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
    <section className="space-y-4" aria-label={level.target.kind === "org" ? level.target.orgName : "Plateforme"}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-navy">
          {level.target.kind === "org" ? level.target.orgName : "Plateforme"}
        </h3>
        {level.role ? <RoleBadge tone="slate">{level.role.name}</RoleBadge> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <fieldset key={group.domain} className="min-w-0 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-navy">{group.label}</legend>
            <ul className="space-y-3">
              {group.permissions.map((def) => {
                const key = def.key as Permission;
                const state = stateOf(overrides, key);
                const canGrant = held.has(key);
                return (
                  <li key={key} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-medium text-slate-900">{def.label}</span>
                        <span className="block text-[12px] text-slate-400">
                          {effective.has(key) ? "Effectif" : "Non effectif"}
                        </span>
                      </span>
                      <select
                        aria-label={`Ajustement : ${def.label}`}
                        value={state}
                        onChange={(e) => setOverrides(setOverrideState(overrides, key, e.target.value as OverrideState))}
                        className="w-28 flex-none rounded-lg border border-slate-300 bg-white px-2 py-1 text-[13px]"
                      >
                        <option value="inherited">{STATE_LABELS.inherited}</option>
                        <option value="granted" disabled={!canGrant && state !== "granted"}>
                          {STATE_LABELS.granted}
                          {!canGrant ? " (non détenue)" : ""}
                        </option>
                        <option value="revoked">{STATE_LABELS.revoked}</option>
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
      <Button loading={pending} onClick={() => void run()}>
        Enregistrer
      </Button>
    </section>
  );
}

export function UserPermissionsEditor(props: Props) {
  return (
    <div className="space-y-10" data-testid="user-permissions-editor">
      {props.levels.map((level) => (
        <LevelEditor key={level.target.kind === "org" ? level.target.orgId : "platform"} {...props} level={level} />
      ))}
    </div>
  );
}
