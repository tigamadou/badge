import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { listProducts } from "@/lib/print-catalog/products";
import { CatalogList } from "@/components/staff/print/CatalogList";

export default async function PrintCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; archived?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const canWrite =
    !!ctx && ctx.isStaff && !!ctx.staffRole && staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN");

  const kind = sp.kind === "BADGE" || sp.kind === "ACCESSORY" ? sp.kind : null;
  const archived = sp.archived === "true";
  const rows = await listProducts({ kind: kind ?? undefined, archived });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Catalogue</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Supports de badge et accessoires proposés aux organisateurs
        </p>
      </div>
      <CatalogList rows={rows} kind={kind} archived={archived} canWrite={canWrite} />
    </div>
  );
}
