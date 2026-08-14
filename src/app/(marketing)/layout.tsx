import { PublicSiteHeader } from "@/components/marketing/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/marketing/PublicSiteFooter";

// Route group (marketing) : chrome partage (header sticky + footer navy) autour
// de toutes les pages publiques du site (accueil, fonctionnalites, tarifs,
// a-propos, contact, pages legales). v4 Bloc site-public.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white text-slate-900">
      <PublicSiteHeader />
      <main>{children}</main>
      <PublicSiteFooter />
    </div>
  );
}
