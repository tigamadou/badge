import type { Metadata } from "next";
import { Icon, type IconName } from "@/components/ui/Icon";
import { displayFont } from "@/components/marketing/styles";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Badge — Contact",
  description: "Demandez une démonstration ou posez-nous vos questions. Notre équipe vous répond sous un jour ouvré.",
};

const INFO: { icon: IconName; title: string; value: string; href?: string }[] = [
  { icon: "mail", title: "E-mail", value: "contact@badge.app", href: "mailto:contact@badge.app" },
  { icon: "smartphone", title: "Téléphone", value: "+33 (0)1 84 80 00 00 · du lundi au vendredi, 9h–18h" },
  { icon: "map-pin", title: "Adresse", value: "12 rue de la Convention, 75015 Paris, France" },
  { icon: "shield-check", title: "Sécurité & RGPD", value: "privacy@badge.app", href: "mailto:privacy@badge.app" },
];

export default function ContactPage() {
  return (
    <section className="py-[88px]">
      <div className="mx-auto grid max-w-[1160px] items-start gap-14 px-7 md:grid-cols-2">
        <div>
          <p className="mb-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-navy">Contact</p>
          <h1 style={displayFont} className="text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-[44px]">
            Parlons de vos événements
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Demandez une démonstration ou posez-nous vos questions. Notre équipe vous répond sous un jour ouvré.
          </p>
          <div className="mt-9 flex flex-col gap-6">
            {INFO.map((it) => (
              <div key={it.title} className="flex items-start gap-3.5">
                <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[11px] bg-mist text-navy">
                  <Icon name={it.icon} size={20} />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">{it.title}</h3>
                  {it.href ? (
                    <a href={it.href} className="text-sm text-slate-500 hover:text-navy">
                      {it.value}
                    </a>
                  ) : (
                    <p className="text-sm leading-relaxed text-slate-500">{it.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-7">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
