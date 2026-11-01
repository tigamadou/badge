"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { CatalogProduct } from "@/lib/print-catalog/pricing-core";

// Image principale + vignettes cliquables (vignettes absentes s'il n'y a qu'une image).
export function ProductGallery({ images }: { images: CatalogProduct["images"] }) {
  const [index, setIndex] = useState(0);
  const current = images[index];
  return (
    <div>
      <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${current.storageKey}`} alt={current.alt} className="h-full w-full object-cover" />
        ) : (
          <Icon name="printer" size={40} />
        )}
      </div>
      {images.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <button
              key={img.storageKey}
              type="button"
              aria-label={`Image ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={`h-14 w-14 overflow-hidden rounded-lg border-2 ${
                i === index ? "border-green-600" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${img.storageKey}`} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
