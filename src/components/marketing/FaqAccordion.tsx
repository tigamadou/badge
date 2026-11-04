import { Icon } from "@/components/ui/Icon";

export function FaqAccordion({
  items,
  defaultOpenFirst,
}: {
  items: { q: string; a: string }[];
  defaultOpenFirst?: boolean;
}) {
  return (
    <div className="mx-auto mt-11 max-w-[760px]">
      {items.map((it, i) => (
        <details
          key={it.q}
          open={defaultOpenFirst && i === 0}
          className="group border-b border-line"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
            {it.q}
            <Icon
              name="chevron-down"
              size={20}
              className="flex-none text-slate-400 transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="max-w-[92%] pb-5 text-[15px] leading-relaxed text-slate-500">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
