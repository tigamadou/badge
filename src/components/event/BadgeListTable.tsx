"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BatchBar, BatchButton } from "@/components/ui/BatchBar";
import { Checkbox } from "@/components/ui/FormControls";
import { CatPill, Tag } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";
import { TableFrame } from "@/components/ui/TableFrame";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput, Toolbar } from "@/components/ui/Toolbar";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";
import { storeSelection } from "@/lib/badge-batch-client";
import { BADGE_PAGE_SIZE_DEFAULT, parseBadgePage } from "@/lib/badge-list-query";
import { useAsyncAction } from "@/hooks/useAsyncAction";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  badgePrinted: boolean;
  allAccessGranted: boolean;
  category: { name: string; color: string; number: number };
};

type Filter = "all" | "printed" | "unprinted" | "allaccess";

const FILTERS: Filter[] = ["all", "printed", "unprinted", "allaccess"];

export function BadgeListTable({ orgId, eventId }: { orgId: string; eventId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Filtre, recherche, page et taille vivent dans l'URL (rechargement et lien partageable).
  const { page, pageSize } = parseBadgePage(searchParams);
  const rawFilter = searchParams.get("filter");
  const filter: Filter = FILTERS.includes(rawFilter as Filter) ? (rawFilter as Filter) : "unprinted";
  const q = searchParams.get("q") ?? "";

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(q);
  const [busy, setBusy] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  // Numero de la derniere requete de liste : une reponse perimee (filtre change entre-temps) est ignoree.
  const latest = useRef(0);
  // Change a chaque modification de filtre/recherche : invalide un « Tout selectionner » en vol.
  const epoch = useRef(0);
  const selectedCount = useRef(0);
  useEffect(() => {
    selectedCount.current = selected.size;
  }, [selected]);

  // Ecrit des parametres dans l'URL sans empiler l'historique ni remonter la page.
  function updateUrl(patch: Record<string, string | null>) {
    // URL courante (pas le rendu figé) : une recherche différée ne doit pas écraser un filtre changé entre-temps.
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const base = `/api/org/${orgId}/events/${eventId}/badges`;
  function filterQuery() {
    const p = new URLSearchParams({ filter });
    if (q) p.set("q", q);
    return p;
  }

  async function load() {
    const mine = ++latest.current;
    setBusy(true);
    try {
      // Endpoint badges dedie : garde par la permission badge.print (accessible au
      // PRINTER, contrairement a /registrations garde par minRole OPERATOR) et DTO
      // minimal (pas d'email ni de structure). Filtres et pagination cote serveur.
      const p = filterQuery();
      p.set("page", String(page));
      p.set("pageSize", String(pageSize));
      const res = await fetch(`${base}?${p}`);
      if (mine !== latest.current) return;
      if (!res.ok) {
        setRows([]);
        setTotal(0);
        return;
      }
      const json = await res.json();
      if (mine !== latest.current) return;
      const count = typeof json.total === "number" ? json.total : 0;
      setRows(json.registrations ?? []);
      setTotal(count);
      // La page demandee n'existe plus (ex. dernier badge marque imprime) : derniere page non vide.
      const lastPage = Math.max(1, Math.ceil(count / pageSize));
      if (page > lastPage) updateUrl({ page: lastPage > 1 ? String(lastPage) : null });
    } catch {
      if (mine !== latest.current) return;
      setRows([]);
      setTotal(0);
    } finally {
      if (mine === latest.current) setBusy(false);
    }
  }

  // Les filtres ont change : la selection (qui portait sur l'ancien filtre) est abandonnee.
  function resetSelection() {
    epoch.current++;
    if (selectedCount.current > 0) toastInfo("La sélection a été réinitialisée.");
    setSelected(new Set());
    setSelectingAll(false);
  }

  // La recherche n'interroge le serveur qu'une fois la frappe terminee.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = search.trim();
      if (next === q) return;
      updateUrl({ q: next || null, page: null });
      resetSelection();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, q, page, pageSize]);

  function changeFilter(next: Filter) {
    updateUrl({ filter: next === "unprinted" ? null : next, page: null });
    resetSelection();
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  // « Tout selectionner » : les ids de TOUTES les inscriptions correspondant aux filtres
  // courants (pas seulement la page affichee), sans limite.
  async function selectAll() {
    if (selected.size > 0 && selected.size === total) {
      setSelected(new Set());
      return;
    }
    setSelectingAll(true);
    const mine = epoch.current;
    try {
      const res = await fetch(`${base}/ids?${filterQuery()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (mine !== epoch.current) return; // filtre change entre-temps : reponse perimee
      setSelected(new Set<string>(json.ids ?? []));
    } catch {
      if (mine === epoch.current) toastError("La sélection a échoué.");
    } finally {
      if (mine === epoch.current) setSelectingAll(false);
    }
  }

  const batchPrint = useAsyncAction(
    async () => {
      const res = await fetch(`/api/org/${orgId}/events/${eventId}/registrations/print`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw res;
      const json = await res.json().catch(() => ({}));
      return typeof json.printed === "number" ? (json.printed as number) : selected.size;
    },
    {
      error: "Le marquage a échoué.",
      onSuccess: (count) => {
        toastSuccess(`${count} badge(s) marqué(s) imprimé(s).`);
        setSelected(new Set());
        void load();
      },
    },
  );

  function openBatchPdf() {
    if (selected.size === 0) return;
    // La sélection (potentiellement des milliers d'ids) ne passe pas par l'URL : elle est rangée
    // dans sessionStorage, l'onglet ouvert la relit par sa clé (copiée à l'ouverture de l'onglet).
    const key = storeSelection(window.sessionStorage, Array.from(selected));
    if (!key) {
      toastError("Impossible de préparer la sélection : le stockage du navigateur est indisponible.");
      return;
    }
    window.open(`/event/${eventId}/badges/print?sel=${key}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un nom ou un identifiant…" />
        <select
          value={filter}
          onChange={(e) => changeFilter(e.target.value as Filter)}
          aria-label="Filtrer les badges"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700"
        >
          <option value="unprinted">Non imprimés</option>
          <option value="printed">Imprimés</option>
          <option value="allaccess">All-access</option>
          <option value="all">Tous</option>
        </select>
        <button
          type="button"
          onClick={() => void selectAll()}
          disabled={selectingAll || total === 0}
          aria-busy={selectingAll || undefined}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-mist disabled:opacity-60"
        >
          {selected.size > 0 && selected.size === total ? "Tout désélectionner" : `Tout sélectionner (${total})`}
        </button>
      </Toolbar>

      <BatchBar count={selected.size}>
        <BatchButton icon="eye" onClick={openBatchPdf}>
          Aperçu PDF
        </BatchButton>
        <BatchButton icon="printer" onClick={() => void batchPrint.run()} loading={batchPrint.pending}>
          Marquer imprimés
        </BatchButton>
      </BatchBar>

      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-left text-[11px] font-semibold uppercase tracking-wider text-white">
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3 hidden md:table-cell">Catégorie</th>
              <th className="px-4 py-3">Badge</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  {busy ? "Chargement…" : "Aucun badge."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-mist">
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    label={<span className="sr-only">Sélectionner {r.firstName}</span>}
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                  {r.firstName} {r.lastName}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <CatPill color={r.category.color} label={`#${r.category.number} ${r.category.name}`} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {r.badgePrinted ? (
                      <Tag icon="check">Imprimé</Tag>
                    ) : (
                      <span className="text-xs text-slate-400">Non imprimé</span>
                    )}
                    {r.allAccessGranted && <Tag>ALL ACCESS</Tag>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/event/${eventId}/badges/${r.id}`}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-navy hover:underline"
                  >
                    <Icon name="eye" size={14} /> Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / pageSize))}
        total={total}
        pageSize={pageSize}
        onPageChange={(next) => updateUrl({ page: next > 1 ? String(next) : null })}
        onPageSizeChange={(size) =>
          updateUrl({ pageSize: size === BADGE_PAGE_SIZE_DEFAULT ? null : String(size), page: null })
        }
      />
    </div>
  );
}
