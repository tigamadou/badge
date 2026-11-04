import { displayFont } from "@/components/marketing/styles";

export function CtaBand({
  title,
  body,
  actions,
}: {
  title: string;
  body: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] bg-navy px-6 py-14 text-center text-white sm:px-14">
      <h2 style={displayFont} className="text-[28px] font-bold tracking-tight sm:text-[34px]">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-[520px] text-base leading-relaxed text-white/75 sm:text-[17px]">{body}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">{actions}</div>
    </div>
  );
}
