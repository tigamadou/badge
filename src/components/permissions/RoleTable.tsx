"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RoleBadge, Tag } from "@/components/ui/Labels";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { readOrThrow } from "./logic";
import type { RoleRow } from "./types";

type Props = {
  roles: RoleRow[];
  apiBase: string;
  /** Modèles d'URL contenant `:id` (une fonction ne peut pas passer d'un Server Component à ce composant client). */
  editHref: string;
  duplicateHref?: string;
  canManage: boolean;
};

const hrefOf = (pattern: string, id: string) => pattern.replace(":id", id);

function RoleActions({ role, apiBase, editHref, duplicateHref, canManage }: Props & { role: RoleRow }) {
  const router = useRouter();
  const archive = useAsyncAction(
    async () => {
      await readOrThrow(await fetch(`${apiBase}/${role.id}`, { method: "DELETE" }));
    },
    { success: "Rôle archivé.", onSuccess: () => router.refresh() },
  );
  const restore = useAsyncAction(
    async () => {
      await readOrThrow(await fetch(`${apiBase}/${role.id}/restore`, { method: "POST" }));
    },
    { success: "Rôle restauré.", onSuccess: () => router.refresh() },
  );
  return (
    <div className="flex flex-wrap items-center gap-3">
      {duplicateHref ? (
        <Link href={hrefOf(duplicateHref, role.id)} className="text-[13px] font-medium text-navy hover:underline">
          Dupliquer
        </Link>
      ) : null}
      {canManage && role.systemKey === null ? (
        <>
          {!role.archived ? (
            <Link href={hrefOf(editHref, role.id)} className="text-[13px] font-medium text-navy hover:underline">
              Modifier
            </Link>
          ) : null}
          {role.archived ? (
            <Button variant="link" className="text-navy" loading={restore.pending} onClick={() => void restore.run()}>
              Restaurer
            </Button>
          ) : (
            <Button variant="link" className="text-rose-600" loading={archive.pending} onClick={() => void archive.run()}>
              Archiver
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
}

export function RoleTable(props: Props) {
  const { roles, editHref } = props;
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white" data-testid="role-table">
      {roles.map((role) => (
        <li key={role.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {role.archived ? (
                <span className="break-words text-sm font-semibold text-navy">{role.name}</span>
              ) : (
                <Link href={hrefOf(editHref, role.id)} className="break-words text-sm font-semibold text-navy hover:underline">
                  {role.name}
                </Link>
              )}
              {role.systemKey !== null ? <RoleBadge tone="navy">Système</RoleBadge> : null}
              {role.archived ? <Tag>Archivé</Tag> : null}
            </div>
            {role.description ? <p className="mt-0.5 break-words text-[13px] text-slate-400">{role.description}</p> : null}
            <p className="mt-0.5 text-[12px] text-slate-400">
              {role.permissions.length} permission{role.permissions.length > 1 ? "s" : ""}
              {role.assignedCount !== undefined
                ? ` · ${role.assignedCount} membre${role.assignedCount > 1 ? "s" : ""}`
                : ""}
            </p>
          </div>
          <RoleActions {...props} role={role} />
        </li>
      ))}
    </ul>
  );
}
