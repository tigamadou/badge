"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/FormControls";
import { Select } from "@/components/ui/Select";
import { Segmented } from "@/components/ui/Tabs";
import { SearchInput } from "@/components/ui/Toolbar";
import { SheetPreview } from "@/components/staff/print/SheetPreview";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { toastSuccess } from "@/lib/toast";
import { toLayoutSpec, type LayoutGeometryRow } from "@/lib/print-sheets/layout-input";

export type LayoutOption = LayoutGeometryRow & { id: string; name: string };

type Category = { id: string; name: string; number: number; approvedCount: number };
type EventOption = { id: string; title: string; approvedCount: number; categories: Category[] };
type OrgOption = { id: string; name: string; events: EventOption[] };
type Registrant = { id: string; firstName: string; lastName: string; categoryId: string };
type EventDetail = {
  badgeMm: { width: number; height: number };
  badgePages: 1 | 2;
  total: number;
  truncated: boolean;
  registrations: Registrant[];
};

type Mode = "ALL" | "CATEGORIES" | "IDS";

// Au-delà, le DOM devient lourd : on invite à affiner la recherche.
const MAX_RENDERED = 200;

const collator = new Intl.Collator("fr", { sensitivity: "base" });

// Commande d'impression dont on génère les planches : organisation, évènement et badges
// (dans l'ordre des positions) sont imposés.
export type LinkedPrintRequest = {
  id: string;
  reference: string;
  orgId: string;
  eventId: string;
  registrationIds: string[];
};

export function GenerationForm({
  layouts,
  onCreated,
  printRequest,
}: {
  layouts: LayoutOption[];
  onCreated: () => void;
  printRequest?: LinkedPrintRequest;
}) {
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [orgId, setOrgId] = useState(printRequest?.orgId ?? "");
  const [eventId, setEventId] = useState(printRequest?.eventId ?? "");
  const [detail, setDetail] = useState<{ eventId: string; data: EventDetail } | null>(null);
  const [mode, setMode] = useState<Mode>(printRequest ? "IDS" : "ALL");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [registrationIds, setRegistrationIds] = useState<string[]>(printRequest?.registrationIds ?? []);
  const [search, setSearch] = useState("");
  const [layoutId, setLayoutId] = useState(layouts[0]?.id ?? "");
  const [duplex, setDuplex] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/platform/print/sheets/options")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => !cancelled && setOrgs(j.organizations))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Format du badge et inscriptions de l'évènement choisi.
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    fetch(`/api/platform/print/sheets/options?eventId=${encodeURIComponent(eventId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => {
        if (cancelled) return;
        setDetail({ eventId, data: j.event });
        setDuplex(true);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const org = orgs?.find((o) => o.id === orgId);
  const event = org?.events.find((e) => e.id === eventId);
  // Le détail d'un autre évènement n'est pas utilisable pendant le chargement.
  const eventDetail = detail && detail.eventId === eventId ? detail.data : null;
  const layout = layouts.find((l) => l.id === layoutId);
  const spec = useMemo(() => (layout ? toLayoutSpec(layout) : null), [layout]);
  const twoPages = eventDetail?.badgePages === 2;

  const badgeCount = !event
    ? 0
    : mode === "ALL"
      ? event.approvedCount
      : mode === "CATEGORIES"
        ? event.categories.filter((c) => categoryIds.includes(c.id)).reduce((n, c) => n + c.approvedCount, 0)
        : registrationIds.length;

  // Tri une seule fois par chargement ; la recherche ne fait que filtrer.
  const sortedRegistrants = useMemo(
    () =>
      [...(eventDetail?.registrations ?? [])].sort(
        (a, b) => collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName),
      ),
    [eventDetail],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q === ""
      ? sortedRegistrants
      : sortedRegistrants.filter((r) => `${r.firstName} ${r.lastName} ${r.id}`.toLowerCase().includes(q));
  }, [sortedRegistrants, search]);
  const registrants = filtered.slice(0, MAX_RENDERED);

  function chooseOrg(id: string) {
    setOrgId(id);
    chooseEvent("");
  }

  function chooseEvent(id: string) {
    setEventId(id);
    setCategoryIds([]);
    setRegistrationIds([]);
    setSearch("");
    setDetail(null);
  }

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const submit = useAsyncAction(
    async () => {
      const selection = printRequest
        ? { mode: "REQUEST" as const }
        : mode === "ALL"
          ? { mode }
          : mode === "CATEGORIES"
            ? { mode, categoryIds }
            : { mode, registrationIds };
      const res = await fetch("/api/platform/print/sheets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          layoutId,
          selection,
          duplex: twoPages && duplex,
          ...(printRequest ? { printRequestId: printRequest.id } : {}),
        }),
      });
      if (!res.ok) throw res;
    },
    {
      error: "Échec du lancement de la génération.",
      onSuccess: () => {
        toastSuccess("Génération lancée.");
        onCreated();
      },
    },
  );

  const canSubmit = !!event && !!layout && !!eventDetail && badgeCount > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <Card>
        <CardHead
          title={printRequest ? `Planches de la commande ${printRequest.reference}` : "Nouvelle génération"}
          subtitle={
            printRequest
              ? "Organisation, évènement et badges sont ceux de la commande ; choisissez le gabarit de planche."
              : "Choisissez les badges à imprimer et le gabarit de planche."
          }
        />
        <CardBody>
          {loadError && (
            <p role="alert" className="mb-4 text-sm text-rose-600">
              Impossible de charger les évènements. Rechargez la page.
            </p>
          )}
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Select
              label="Organisation"
              value={orgId}
              disabled={!!printRequest}
              onChange={(e) => chooseOrg(e.target.value)}
              options={(orgs ?? []).map((o) => ({ value: o.id, label: o.name }))}
            />
            <Select
              label="Évènement"
              value={eventId}
              disabled={!org || !!printRequest}
              onChange={(e) => chooseEvent(e.target.value)}
              options={(org?.events ?? []).map((e) => ({
                value: e.id,
                label: `${e.title} (${e.approvedCount} approuvé${e.approvedCount > 1 ? "s" : ""})`,
              }))}
            />
          </div>

          {event && printRequest && (
            <p className="mb-4 text-sm text-slate-700">
              {`${printRequest.registrationIds.length} badge${printRequest.registrationIds.length > 1 ? "s" : ""} de la commande, dans l'ordre de la commande.`}
            </p>
          )}
          {event && !printRequest && (
            <div className="mb-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">Inscriptions à imprimer</p>
              <Segmented
                options={[
                  { value: "ALL", label: "Tous les approuvés" },
                  { value: "CATEGORIES", label: "Par catégorie" },
                  { value: "IDS", label: "Sélection" },
                ]}
                value={mode}
                onChange={(v) => setMode(v as Mode)}
              />

              {mode === "CATEGORIES" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {event.categories.length === 0 && (
                    <p className="text-sm text-slate-400">Aucune catégorie.</p>
                  )}
                  {event.categories.map((c) => (
                    <Checkbox
                      key={c.id}
                      checked={categoryIds.includes(c.id)}
                      onChange={() => setCategoryIds((l) => toggle(l, c.id))}
                      label={`${c.name} (${c.approvedCount})`}
                    />
                  ))}
                </div>
              )}

              {mode === "IDS" && (
                <div>
                  <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un nom ou un identifiant" />
                  {eventDetail?.truncated && (
                    <p className="mb-2 text-sm text-warn">
                      Liste limitée aux 5 000 premières inscriptions : utilisez « Tous les approuvés » ou « Par
                      catégorie » pour imprimer les autres.
                    </p>
                  )}
                  {filtered.length > 0 && (
                    <div className="mb-2 flex items-center gap-3 text-[13px]">
                      <Button
                        type="button"
                        variant="link"
                        className="text-navy"
                        onClick={() =>
                          setRegistrationIds((l) => [...new Set([...l, ...filtered.map((r) => r.id)])])
                        }
                      >
                        Tout sélectionner ({filtered.length})
                      </Button>
                      <Button type="button" variant="link" className="text-slate-500" onClick={() => setRegistrationIds([])}>
                        Tout désélectionner
                      </Button>
                    </div>
                  )}
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                    {!eventDetail && <p className="text-sm text-slate-400">Chargement…</p>}
                    {eventDetail && registrants.length === 0 && (
                      <p className="text-sm text-slate-400">Aucune inscription approuvée.</p>
                    )}
                    {registrants.map((r) => (
                      <Checkbox
                        key={r.id}
                        checked={registrationIds.includes(r.id)}
                        onChange={() => setRegistrationIds((l) => toggle(l, r.id))}
                        label={`${r.lastName} ${r.firstName} · ${r.id}`}
                      />
                    ))}
                    {filtered.length > MAX_RENDERED && (
                      <p className="text-sm text-slate-500">
                        {filtered.length - MAX_RENDERED} autres résultats : affinez la recherche.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <Select
            label="Gabarit"
            value={layoutId}
            onChange={(e) => setLayoutId(e.target.value)}
            options={layouts.map((l) => ({ value: l.id, label: l.name }))}
          />
          {layouts.length === 0 && (
            <p className="-mt-2 mb-4 text-sm text-slate-400">
              Aucun gabarit : créez-en un dans « Gabarits » avant de générer.
            </p>
          )}

          {twoPages && printRequest && (
            <p className="mb-4 text-sm text-slate-500">Recto-verso imposé (le template a deux pages).</p>
          )}
          {twoPages && !printRequest && (
            <div className="mb-4">
              <Checkbox checked={duplex} onChange={setDuplex} label="Recto-verso (le template a deux pages)" />
            </div>
          )}

          <Button type="button" disabled={!canSubmit} loading={submit.pending} onClick={() => void submit.run()}>
            Générer
          </Button>
        </CardBody>
      </Card>

      <Card className="self-start">
        <CardHead title="Aperçu de la planche" />
        <CardBody>
          {spec ? (
            <SheetPreview
              spec={spec}
              badgeMm={eventDetail?.badgeMm ?? null}
              badgeCount={badgeCount > 0 ? badgeCount : undefined}
            />
          ) : (
            <p className="text-sm text-slate-400">Choisissez un gabarit.</p>
          )}
          {event && (
            <p className="mt-3 text-sm text-slate-700">
              {badgeCount} badge{badgeCount > 1 ? "s" : ""} sélectionné{badgeCount > 1 ? "s" : ""}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
