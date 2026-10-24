// Clé de bannière -> URL publique servie par /api/files (même forme que le logo).
export function eventCoverUrl(banner: string | null | undefined): string | null {
  return banner ? `/api/files/${banner}` : null;
}

const VARIANT_CLASSES = {
  hero: "aspect-[3/1] max-h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100",
  thumb: "aspect-video w-full overflow-hidden rounded-lg bg-slate-100",
} as const;

export function EventCover({
  bannerUrl,
  title,
  variant,
}: {
  bannerUrl: string | null | undefined;
  title: string;
  variant: keyof typeof VARIANT_CLASSES;
}) {
  if (!bannerUrl) return null;
  return (
    <div className={VARIANT_CLASSES[variant]}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bannerUrl} alt={title} className="h-full w-full object-cover" />
    </div>
  );
}
