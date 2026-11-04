import type { ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function OrgLogo({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-[10px] bg-mist font-bold text-navy"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

export function PickCard({
  href,
  logo,
  title,
  subtitle,
  meta,
}: {
  href: string;
  logo: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-navy"
    >
      {logo}
      <div>
        <div className="text-sm font-semibold text-navy">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs text-slate-400">{subtitle}</div> : null}
      </div>
      {meta ? <div className="text-xs text-slate-400">{meta}</div> : null}
    </Link>
  );
}

export function PickCardDashed({ href, icon, label }: { href: string; icon: IconName; label: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-slate-600 transition-colors hover:border-navy"
    >
      <Icon name={icon} size={22} />
      {label}
    </Link>
  );
}
