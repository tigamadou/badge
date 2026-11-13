"use client";
import { Icon } from "@/components/ui/Icon";
import { startingPrice, formatFcfa, type CatalogProduct } from "@/lib/print-catalog/pricing-core";

// Carte de la vitrine : cliquable (bouton) seulement si onSelect est fourni.
export function ProductCard({
  product,
  selected,
  onSelect,
  disabledReason,
}: {
  product: CatalogProduct;
  selected?: boolean;
  onSelect?: () => void;
  /** Carte non sélectionnable, avec la raison affichée. */
  disabledReason?: string | null;
}) {
  const image = product.images[0];
  const content = (
    <>
      <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-t-xl bg-mist text-slate-400">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${image.storageKey}`} alt={image.alt} className="h-full w-full object-cover" />
        ) : (
          <Icon name="printer" size={32} />
        )}
      </div>
      <div className="px-4 py-3">
        {product.category ? <div className="text-xs text-slate-400">{product.category}</div> : null}
        <div className="mt-0.5 text-sm font-semibold text-navy">{product.name}</div>
        <div className="mt-1 text-[13px] text-slate-700">{`À partir de ${formatFcfa(startingPrice(product))}`}</div>
        {product.leadTimeDays ? (
          <div className="mt-0.5 text-xs text-slate-400">{`Fabrication : ${product.leadTimeDays} jour${product.leadTimeDays > 1 ? "s" : ""}`}</div>
        ) : null}
        {disabledReason ? <div className="mt-1 text-xs text-warn">{disabledReason}</div> : null}
      </div>
    </>
  );
  const base = "block w-full overflow-hidden rounded-xl border bg-white text-left";
  if (!onSelect) return <div className={`${base} border-slate-200`}>{content}</div>;
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      disabled={!!disabledReason}
      onClick={onSelect}
      className={`${base} transition-colors focus:outline-none focus:ring-2 focus:ring-navy ${
        selected ? "border-navy ring-2 ring-navy" : "border-slate-200 hover:border-navy"
      } ${disabledReason ? "cursor-not-allowed opacity-60" : ""}`}
    >
      {content}
    </button>
  );
}
