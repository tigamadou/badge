"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RadioCards } from "@/components/ui/RadioCards";
import { Stepper } from "@/components/ui/Stepper";
import { ProductCard } from "@/components/print/ProductCard";
import { ProductConfigurator, type ProductConfiguration } from "@/components/print/ProductConfigurator";
import { withBadgeQuantity } from "./accessory-quantity";
import { QuoteLinesTable, type QuoteLineView } from "@/components/print/QuoteLinesTable";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { ActionError, toastSuccess } from "@/lib/toast";
import { PRINT_REQUEST_TYPE_LABELS } from "@/lib/print-requests/labels";
import { creditOfferSentence } from "@/lib/print-requests/credit-view";
import {
  choiceErrorMessage,
  defaultConfiguration,
  pruneChoices,
  validateChoices,
  type CatalogProduct,
  type OptionChoice,
} from "@/lib/print-catalog/pricing-core";
import { BadgeSelectionStep } from "./BadgeSelectionStep";
import {
  buildSelection,
  initialSelectionState,
  type Candidate,
  type SelectionState,
} from "./selection";

type Slot = { date: string; from: string; to: string };

type RequestDTO = {
  id: string;
  type: "ADVANCE" | "ONSITE";
  status: string;
  delivery: "PICKUP" | "DELIVERY" | null;
  deliveryAddress: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  wantedBy: string | null;
  estimatedQuantity: number | null;
  onsiteSchedule: unknown;
  onsiteLocation: string | null;
  onsiteContactName: string | null;
  onsiteContactPhone: string | null;
  notes: string | null;
  total: number;
};

type LineDTO = QuoteLineView & {
  kind: string;
  productId: string | null;
  choices: unknown;
  addedBy: "ORGANIZER" | "STAFF";
};

type Loaded = { request: RequestDTO; lines: LineDTO[]; badgeCount: number };

const EDITABLE = ["DRAFT", "SUBMITTED", "QUOTED"];

function slotsOf(value: unknown): Slot[] {
  return Array.isArray(value) ? (value as Slot[]).map((s) => ({ date: s.date, from: s.from, to: s.to })) : [];
}

const textareaClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy";

export function PrintRequestWizard({
  orgId,
  eventId,
  requestId,
  availableCredit = 0,
}: {
  orgId: string;
  eventId: string;
  requestId: string;
  /** Crédit d'impression libre de l'organisation, proposé au récapitulatif. */
  availableCredit?: number;
}) {
  const router = useRouter();
  const base = `/api/org/${orgId}/events/${eventId}/print-requests`;
  const detailUrl = `/event/${eventId}/print/${requestId}`;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [badgeCatalog, setBadgeCatalog] = useState<CatalogProduct[]>([]);
  const [accessoryCatalog, setAccessoryCatalog] = useState<CatalogProduct[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [step, setStep] = useState(1);
  const [badgeCount, setBadgeCount] = useState(0);
  const [lines, setLines] = useState<LineDTO[]>([]);
  const [total, setTotal] = useState(0);

  const [sel, setSel] = useState<SelectionState>({ mode: "ALL_AVAILABLE", categoryIds: [], registrationIds: [] });
  const [selDirty, setSelDirty] = useState(false);
  const [quantity, setQuantity] = useState("");

  const [badgeId, setBadgeId] = useState<string | null>(null);
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);
  const [configs, setConfigs] = useState<Record<string, ProductConfiguration>>({});
  const [orphans, setOrphans] = useState<string[]>([]);

  const [delivery, setDelivery] = useState<"PICKUP" | "DELIVERY" | null>(null);
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [wantedBy, setWantedBy] = useState("");
  const [location, setLocation] = useState("");
  const [slots, setSlots] = useState<Slot[]>([{ date: "", from: "", to: "" }]);
  const [notes, setNotes] = useState("");

  async function api<T>(path: string, method: string, body?: unknown): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw res;
    return (await res.json()) as T;
  }

  async function uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${base}/upload`, { method: "POST", body: form });
    if (!res.ok) throw res;
    return ((await res.json()) as { storageKey: string }).storageKey;
  }

  // Chargement initial : commande, catalogues et (en amont) badges candidats.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const get = async <T,>(url: string): Promise<T> => {
          const res = await fetch(url);
          if (!res.ok) throw res;
          return (await res.json()) as T;
        };
        const data = await get<Loaded>(`${base}/${requestId}`);
        const [badges, accessories] = await Promise.all([
          get<{ products: CatalogProduct[] }>("/api/print/catalog?kind=BADGE"),
          get<{ products: CatalogProduct[] }>("/api/print/catalog?kind=ACCESSORY"),
        ]);
        const cands =
          data.request.type === "ADVANCE"
            ? (await get<{ candidates: Candidate[] }>(`${base}/${requestId}/registrations`)).candidates
            : [];
        if (cancelled) return;
        if (!EDITABLE.includes(data.request.status)) {
          router.replace(`/event/${eventId}/print/${requestId}`);
          return;
        }
        const r = data.request;
        setBadgeCatalog(badges.products);
        setAccessoryCatalog(accessories.products);
        setCandidates(cands);
        setSel(initialSelectionState(cands));
        setBadgeCount(data.badgeCount);
        setLines(data.lines);
        setTotal(r.total);
        setQuantity(r.estimatedQuantity ? String(r.estimatedQuantity) : "");
        // Les choix enregistrés passent par pruneChoices avant d'alimenter le configurateur.
        const all = [...badges.products, ...accessories.products];
        const nextConfigs: Record<string, ProductConfiguration> = {};
        const accessories2: string[] = [];
        const missing: string[] = [];
        let badge: string | null = null;
        for (const line of data.lines) {
          if (line.kind !== "PRODUCT" || line.addedBy !== "ORGANIZER" || !line.productId) continue;
          const product = all.find((p) => p.id === line.productId);
          if (!product) {
            missing.push(line.label);
            continue;
          }
          // La quantité d'un accessoire suit le nombre de badges (spec 39), pas la ligne enregistrée.
          nextConfigs[product.id] = {
            quantity: product.kind === "BADGE" ? line.quantity : data.badgeCount,
            choices: pruneChoices(product, (line.choices ?? []) as OptionChoice[]),
          };
          if (product.kind === "BADGE") badge = product.id;
          else accessories2.push(product.id);
        }
        setConfigs(nextConfigs);
        setBadgeId(badge);
        setAccessoryIds(accessories2);
        setOrphans(missing);
        setDelivery(r.delivery);
        setAddress(r.deliveryAddress ?? "");
        setContactName((r.type === "ADVANCE" ? r.deliveryContactName : r.onsiteContactName) ?? "");
        setContactPhone((r.type === "ADVANCE" ? r.deliveryContactPhone : r.onsiteContactPhone) ?? "");
        setWantedBy(r.wantedBy ? r.wantedBy.slice(0, 10) : "");
        setLocation(r.onsiteLocation ?? "");
        const existing = slotsOf(r.onsiteSchedule);
        setSlots(existing.length > 0 ? existing : [{ date: "", from: "", to: "" }]);
        setNotes(r.notes ?? "");
        setLoaded(data);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Chargement unique au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Récapitulatif : lignes et total à jour (le serveur recalcule après chaque modification).
  useEffect(() => {
    if (step !== 5) return;
    let cancelled = false;
    fetch(`${base}/${requestId}`)
      .then((res) => (res.ok ? (res.json() as Promise<Loaded>) : null))
      .then((data) => {
        if (!data || cancelled) return;
        setLines(data.lines);
        setBadgeCount(data.badgeCount);
        setTotal(data.request.total);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [step, base, requestId]);

  const type = loaded?.request.type ?? "ADVANCE";
  const isDraft = loaded?.request.status === "DRAFT";
  const steps = ["Type", type === "ADVANCE" ? "Badges" : "Quantité", "Support", "Accessoires", "Remise", "Récapitulatif"];

  const productById = useMemo(
    () => new Map([...badgeCatalog, ...accessoryCatalog].map((p) => [p.id, p])),
    [badgeCatalog, accessoryCatalog],
  );
  const configOf = (product: CatalogProduct): ProductConfiguration =>
    configs[product.id] ?? defaultConfiguration(product);
  const setConfig = (id: string, value: ProductConfiguration) => setConfigs((c) => ({ ...c, [id]: value }));

  // Produits à envoyer : le support (quantité = nombre de badges) puis les accessoires.
  function productsPayload() {
    const badge = badgeId ? productById.get(badgeId) : undefined;
    if (!badge) throw new ActionError("Choisissez un support de badge.");
    const entries = [badge, ...accessoryIds.map((id) => productById.get(id)).filter((p): p is CatalogProduct => !!p)];
    return entries.map((product) => {
      const cfg = withBadgeQuantity(configOf(product), badgeCount);
      const check = validateChoices(product, cfg.choices, cfg.quantity);
      if (!check.ok) throw new ActionError(`${product.name} : ${choiceErrorMessage(check.code)}`);
      return { productId: product.id, quantity: product.kind === "BADGE" ? null : cfg.quantity, choices: cfg.choices };
    });
  }

  async function saveProducts() {
    const out = await api<{ lines: LineDTO[]; total: number }>(`/${requestId}/products`, "PUT", {
      products: productsPayload(),
    });
    setLines(out.lines);
    setTotal(out.total);
  }

  async function saveDetails() {
    if (type === "ADVANCE") {
      if (!delivery) throw new ActionError("Choisissez un mode de remise.");
      await api(`/${requestId}`, "PATCH", {
        delivery,
        deliveryAddress: address,
        deliveryContactName: contactName,
        deliveryContactPhone: contactPhone,
        wantedBy: wantedBy || null,
        notes: notes.trim() ? notes : null,
      });
      return;
    }
    const complete = slots.filter((s) => s.date && s.from && s.to);
    if (complete.length === 0) throw new ActionError("Ajoutez au moins un créneau de présence.");
    await api(`/${requestId}`, "PATCH", {
      onsiteSchedule: complete,
      onsiteLocation: location,
      onsiteContactName: contactName,
      onsiteContactPhone: contactPhone,
      notes: notes.trim() ? notes : null,
    });
  }

  async function saveStep() {
    if (step === 1) {
      if (type === "ONSITE") {
        const n = Number(quantity);
        if (!Number.isInteger(n) || n < 1) throw new ActionError("Indiquez le nombre de badges à imprimer.");
        await api(`/${requestId}`, "PATCH", { estimatedQuantity: n });
        setBadgeCount(n);
      } else if (selDirty || badgeCount === 0) {
        const selection = buildSelection(candidates, sel);
        if (!selection) throw new ActionError("Sélectionnez au moins un badge.");
        const out = await api<{ count: number }>(`/${requestId}/badges`, "PUT", { selection });
        setBadgeCount(out.count);
        setSelDirty(false);
      }
    } else if (step === 2 || step === 3) {
      await saveProducts();
    } else if (step === 4) {
      await saveDetails();
    }
    setStep(step + 1);
  }
  const { run: next, pending: saving } = useAsyncAction(saveStep);

  const { run: finish, pending: finishing } = useAsyncAction(
    async () => {
      if (isDraft) await api(`/${requestId}/submit`, "POST");
    },
    {
      onSuccess: () => {
        toastSuccess(isDraft ? "Commande envoyée." : "Modifications enregistrées.");
        router.push(detailUrl);
        router.refresh();
      },
    },
  );

  if (loadFailed) return <Alert tone="err">Impossible de charger la commande. Rechargez la page.</Alert>;
  if (!loaded) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const badgeProduct = badgeId ? productById.get(badgeId) : undefined;
  const deliverySummary =
    type === "ADVANCE"
      ? delivery === "DELIVERY"
        ? `Livraison : ${address}`
        : "Retrait"
      : `Sur place : ${location}`;

  return (
    <div>
      <Stepper steps={steps} current={step} />
      <div className="mb-4 text-sm text-slate-500">{`Type de commande : ${PRINT_REQUEST_TYPE_LABELS[type]}`}</div>

      {orphans.length > 0 && (step === 2 || step === 3) ? (
        <div className="mb-4">
          <Alert tone="warn">{`Ces produits ne sont plus proposés et seront retirés de la commande : ${orphans.join(", ")}.`}</Alert>
        </div>
      ) : null}

      {step === 1 && type === "ADVANCE" ? (
        <BadgeSelectionStep
          candidates={candidates}
          state={sel}
          onChange={(s) => {
            setSel(s);
            setSelDirty(true);
          }}
        />
      ) : null}

      {step === 1 && type === "ONSITE" ? (
        <div className="max-w-sm">
          <Input
            label="Nombre de badges à imprimer sur place"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          {badgeCatalog.length === 0 ? <Alert tone="warn">Aucun support de badge n&apos;est proposé pour le moment.</Alert> : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {badgeCatalog.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selected={product.id === badgeId}
                onSelect={() => {
                  setBadgeId(product.id);
                  if (!configs[product.id]) setConfig(product.id, defaultConfiguration(product));
                }}
              />
            ))}
          </div>
          {badgeProduct ? (
            <ProductConfigurator
              product={badgeProduct}
              value={{ quantity: badgeCount, choices: configOf(badgeProduct).choices }}
              onChange={(v) => setConfig(badgeProduct.id, { quantity: badgeCount, choices: v.choices })}
              uploadFile={uploadFile}
              quantityLocked
            />
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          <p className="text-sm text-slate-500">Cordons, porte-badges… Choisissez les accessoires de votre commande (facultatif).</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accessoryCatalog.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selected={accessoryIds.includes(product.id)}
                onSelect={() => {
                  setAccessoryIds((ids) =>
                    ids.includes(product.id) ? ids.filter((i) => i !== product.id) : [...ids, product.id],
                  );
                  if (!configs[product.id]) setConfig(product.id, defaultConfiguration(product));
                }}
              />
            ))}
          </div>
          {accessoryIds.map((id) => {
            const product = productById.get(id);
            if (!product) return null;
            return (
              <div key={id} className="rounded-xl border border-slate-200 bg-white p-4">
                <ProductConfigurator
                  product={product}
                  value={withBadgeQuantity(configOf(product), badgeCount)}
                  onChange={(v) => setConfig(id, { quantity: badgeCount, choices: v.choices })}
                  uploadFile={uploadFile}
                  quantityLocked
                />
                <p className="mt-2 text-xs text-slate-500">Calculée sur le nombre de badges ({badgeCount}).</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="max-w-xl space-y-1">
          {type === "ADVANCE" ? (
            <>
              <RadioCards
                name="Mode de remise"
                options={[
                  { value: "PICKUP", title: "Retrait", description: "Vous récupérez les badges auprès de l'équipe Badge" },
                  { value: "DELIVERY", title: "Livraison", description: "Les badges vous sont livrés à l'adresse indiquée" },
                ]}
                value={delivery}
                onChange={(v) => setDelivery(v as "PICKUP" | "DELIVERY")}
              />
              <div className="pt-4" />
              {delivery === "DELIVERY" ? (
                <>
                  <Input label="Adresse de livraison" value={address} maxLength={500} onChange={(e) => setAddress(e.target.value)} />
                  <Input label="Nom du contact" value={contactName} maxLength={120} onChange={(e) => setContactName(e.target.value)} />
                  <Input label="Téléphone du contact" type="tel" value={contactPhone} maxLength={40} onChange={(e) => setContactPhone(e.target.value)} />
                </>
              ) : null}
              <Input label="Date souhaitée (facultatif)" type="date" value={wantedBy} onChange={(e) => setWantedBy(e.target.value)} />
            </>
          ) : (
            <>
              <Input label="Lieu d'impression" value={location} maxLength={500} onChange={(e) => setLocation(e.target.value)} />
              <Input label="Nom du contact sur place" value={contactName} maxLength={120} onChange={(e) => setContactName(e.target.value)} />
              <Input label="Téléphone du contact" type="tel" value={contactPhone} maxLength={40} onChange={(e) => setContactPhone(e.target.value)} />
              <div className="mb-4">
                <div className="mb-1 text-sm font-medium text-slate-700">Créneaux de présence</div>
                <div className="space-y-2">
                  {slots.map((slot, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input
                        aria-label="Date du créneau"
                        type="date"
                        value={slot.date}
                        onChange={(e) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        aria-label="Heure de début"
                        type="time"
                        value={slot.from}
                        onChange={(e) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        aria-label="Heure de fin"
                        type="time"
                        value={slot.to}
                        onChange={(e) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      {slots.length > 1 ? (
                        <button type="button" className="text-xs text-rose-600" onClick={() => setSlots((s) => s.filter((_, j) => j !== i))}>
                          Retirer
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 text-[13px] font-medium text-navy hover:underline"
                  onClick={() => setSlots((s) => [...s, { date: "", from: "", to: "" }])}
                >
                  Ajouter un créneau
                </button>
              </div>
            </>
          )}
          <div>
            <label htmlFor="print-notes" className="mb-1 block text-sm font-medium text-slate-700">
              Remarques (facultatif)
            </label>
            <textarea id="print-notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClass} />
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-4">
          <QuoteLinesTable lines={lines} total={total} badgeCount={badgeCount} />
          <p className="text-sm text-slate-500">{deliverySummary}</p>
          <Alert tone="info">Le prix définitif est fixé par l&apos;équipe Badge dans le devis.</Alert>
          {availableCredit > 0 ? <Alert tone="info">{creditOfferSentence(availableCredit)}</Alert> : null}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          type="button"
          disabled={step <= 1 || saving || finishing}
          onClick={() => setStep(step - 1)}
        >
          Précédent
        </Button>
        {step < 5 ? (
          <Button type="button" loading={saving} onClick={() => void next()}>
            Suivant
          </Button>
        ) : (
          <Button type="button" loading={finishing} onClick={() => void finish()}>
            {isDraft ? "Envoyer la commande" : "Enregistrer les modifications"}
          </Button>
        )}
      </div>
    </div>
  );
}
