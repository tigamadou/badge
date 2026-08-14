import { displayFont } from "@/components/marketing/styles";

export function SectionHeading({
  eyebrow,
  title,
  lede,
  center,
  onNavy,
  as = "h2",
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  center?: boolean;
  onNavy?: boolean;
  as?: "h1" | "h2";
}) {
  const Title = as;
  return (
    <div className={center ? "mx-auto max-w-[720px] text-center" : "max-w-[720px]"}>
      <p
        className={`mb-3.5 text-xs font-semibold uppercase tracking-[0.1em] ${
          onNavy ? "text-green-400" : "text-green-600"
        }`}
      >
        {eyebrow}
      </p>
      <Title
        style={displayFont}
        className={`text-3xl font-bold leading-[1.08] tracking-tight md:text-[38px] ${
          onNavy ? "text-white" : "text-slate-900"
        }`}
      >
        {title}
      </Title>
      {lede && (
        <p className={`mt-4 text-lg leading-relaxed ${onNavy ? "text-white/75" : "text-slate-600"}`}>{lede}</p>
      )}
    </div>
  );
}
