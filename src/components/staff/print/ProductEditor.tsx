"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Switch } from "@/components/ui/FormControls";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { ActionError } from "@/lib/toast";
import { ProductCard } from "@/components/print/ProductCard";
import { ProductConfigurator, type ProductConfiguration } from "@/components/print/ProductConfigurator";
import { defaultConfiguration, type CatalogProduct } from "@/lib/print-catalog/pricing-core";
import { PRODUCTS_API, parseInt0, sendJson, VALIDATION_MESSAGE } from "./catalog-api";
import { ProductGalleryEditor } from "./ProductGalleryEditor";
import { ProductOptionsEditor } from "./ProductOptionsEditor";
import { ProductTiersEditor } from "./ProductTiersEditor";

const TABS = [
  { value: "info", label: "Informations" },
  { value: "gallery", label: "Galerie" },
  { value: "tiers", label: "Tarifs" },
  { value: "options", label: "Options" },
  { value: "preview", label: "Aperçu" },
];

function StatusPill({ product }: { product: CatalogProduct }) {
  const [label, cls] = product.archived
    ? ["Archivé", "bg-slate-100 text-slate-600"]
    : product.published
      ? ["Publié", "bg-emerald-50 text-emerald-700"]
      : ["Brouillon", "bg-amber-50 text-amber-700"];
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function InfoForm({
  product,
  disabled,
  onSaved,
}: {
  product: CatalogProduct;
  disabled: boolean;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: product.name,
    category: product.category ?? "",
    description: product.description ?? "",
    basePrice: String(product.basePrice),
    minQuantity: String(product.minQuantity),
    leadTimeDays: product.leadTimeDays === null ? "" : String(product.leadTimeDays),
  });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = useAsyncAction(
    async () => {
      const basePrice = parseInt0(f.basePrice);
      const minQuantity = parseInt0(f.minQuantity);
      const leadTimeDays = f.leadTimeDays.trim() === "" ? null : parseInt0(f.leadTimeDays);
      if (!f.name.trim()) throw new ActionError("Le nom est requis.");
      if (basePrice === null) throw new ActionError("Le prix de base doit être un entier positif ou nul.");
      if (minQuantity === null || minQuantity < 1) throw new ActionError("La quantité minimale doit être au moins 1.");
      if (f.leadTimeDays.trim() !== "" && leadTimeDays === null) throw new ActionError("Le délai doit être un nombre de jours entier.");
      await sendJson(`${PRODUCTS_API}/${product.id}`, "PATCH", {
        name: f.name.trim(),
        category: f.category.trim() === "" ? null : f.category.trim(),
        description: f.description.trim() === "" ? null : f.description,
        basePrice,
        minQuantity,
        leadTimeDays,
      });
    },
    { success: "Produit enregistré.", error: VALIDATION_MESSAGE, onSuccess: onSaved },
  );

  return (
    <div className="max-w-xl">
      <Input label="Nom" value={f.name} maxLength={120} disabled={disabled} onChange={(e) => set({ name: e.target.value })} />
      <Input label="Catégorie" value={f.category} maxLength={60} disabled={disabled} onChange={(e) => set({ category: e.target.value })} />
      <div className="mb-4">
        <label htmlFor="product-description" className="mb-1 block text-sm font-medium text-slate-700">Description</label>
        <textarea
          id="product-description"
          rows={4}
          maxLength={5000}
          value={f.description}
          disabled={disabled}
          onChange={(e) => set({ description: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <div className="grid gap-x-4 sm:grid-cols-3">
        <Input label="Prix de base (FCFA)" type="number" min={0} step={1} value={f.basePrice} disabled={disabled} onChange={(e) => set({ basePrice: e.target.value })} />
        <Input label="Quantité minimale" type="number" min={1} step={1} value={f.minQuantity} disabled={disabled} onChange={(e) => set({ minQuantity: e.target.value })} />
        <Input label="Délai (jours)" type="number" min={0} step={1} value={f.leadTimeDays} disabled={disabled} onChange={(e) => set({ leadTimeDays: e.target.value })} />
      </div>
      {disabled ? null : (
        <Button type="button" disabled={save.pending} onClick={() => void save.run()}>
          Enregistrer
        </Button>
      )}
    </div>
  );
}

function Preview({ product }: { product: CatalogProduct }) {
  // Un brouillon s'aperçoit comme une fiche publiée (ruling C5).
  const shown: CatalogProduct = { ...product, published: true, archived: false };
  const [value, setValue] = useState<ProductConfiguration>(() => defaultConfiguration(shown));
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">{"Fiche telle que l'organisateur la verra."}</p>
      <div className="max-w-xs">
        <ProductCard product={shown} />
      </div>
      <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-4">
        <ProductConfigurator product={shown} value={value} onChange={setValue} />
      </div>
    </div>
  );
}

// Signature d'une tranche de données : remonte le sous-éditeur quand le serveur renvoie du neuf.
const sig = (x: unknown) => JSON.stringify(x);

export function ProductEditor({ product, canWrite }: { product: CatalogProduct; canWrite: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState("info");
  const [confirming, setConfirming] = useState(false);
  const disabled = !canWrite || product.archived;
  const refresh = () => router.refresh();

  const publish = useAsyncAction(
    async (next: boolean) => sendJson(`${PRODUCTS_API}/${product.id}`, "PATCH", { published: next }),
    { error: VALIDATION_MESSAGE, onSuccess: refresh },
  );
  const archive = useAsyncAction(() => sendJson(`${PRODUCTS_API}/${product.id}`, "DELETE"), {
    success: "Produit archivé.",
    error: "Échec de l'archivage.",
    onSuccess: () => {
      setConfirming(false);
      router.push("/platform/print/catalog");
      router.refresh();
    },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{product.name}</h1>
          <StatusPill product={product} />
        </div>
        {disabled ? null : (
          <div className="flex flex-wrap items-center gap-4">
            <Switch
              checked={product.published}
              label="Publié"
              onChange={(v) => void publish.run(v)}
            />
            <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
              Archiver
            </Button>
          </div>
        )}
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <div hidden={tab !== "info"}>
        <InfoForm
          key={sig([product.name, product.category, product.description, product.basePrice, product.minQuantity, product.leadTimeDays])}
          product={product}
          disabled={disabled}
          onSaved={refresh}
        />
      </div>
      <div hidden={tab !== "gallery"}>
        <ProductGalleryEditor key={sig(product.images)} productId={product.id} images={product.images} disabled={disabled} onSaved={refresh} />
      </div>
      <div hidden={tab !== "tiers"}>
        <ProductTiersEditor key={sig(product.priceTiers)} productId={product.id} tiers={product.priceTiers} disabled={disabled} onSaved={refresh} />
      </div>
      <div hidden={tab !== "options"}>
        <ProductOptionsEditor key={sig(product.options)} productId={product.id} options={product.options} disabled={disabled} onSaved={refresh} />
      </div>
      {tab === "preview" ? <Preview key={sig(product)} product={product} /> : null}

      <Dialog
        open={confirming}
        title="Archiver ce produit ?"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              Annuler
            </Button>
            <Button type="button" variant="danger" disabled={archive.pending} onClick={() => void archive.run()}>
              Archiver
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {"Le produit disparaît de la vitrine ; les demandes d'impression existantes le conservent."}
        </p>
      </Dialog>
    </div>
  );
}
