import Link from "next/link";

export type PaymentFilterValues = {
  status?: string;
  purpose?: string;
  from?: string;
  to?: string;
  q?: string;
  orgQuery?: string;
};

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const label = "mb-1 block text-xs font-medium text-slate-500";

// Formulaire GET : les filtres vivent dans l'URL (rechargement et partage conservent le résultat).
// `page` n'est pas renvoyé : un nouveau filtre repart de la première page.
export function PaymentFilters({
  values,
  showOrg,
  pageSize,
  resetHref,
}: {
  values: PaymentFilterValues;
  showOrg: boolean;
  pageSize?: number;
  resetHref: string;
}) {
  return (
    <form method="get" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
      {showOrg && (
        <div>
          <label className={label} htmlFor="pf-org">Organisation</label>
          <input id="pf-org" name="orgQuery" defaultValue={values.orgQuery ?? ""} placeholder="Nom ou identifiant" className={field} />
        </div>
      )}
      <div>
        <label className={label} htmlFor="pf-status">Statut</label>
        <select id="pf-status" name="status" defaultValue={values.status ?? ""} className={field}>
          <option value="">Tous</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Payé</option>
          <option value="DECLINED">Refusé</option>
          <option value="CANCELED">Annulé</option>
          <option value="EXPIRED">Expiré</option>
        </select>
      </div>
      <div>
        <label className={label} htmlFor="pf-purpose">Type</label>
        <select id="pf-purpose" name="purpose" defaultValue={values.purpose ?? ""} className={field}>
          <option value="">Tous</option>
          <option value="SUBSCRIPTION">Abonnement</option>
          <option value="PRINT_REQUEST">Impression</option>
        </select>
      </div>
      <div>
        <label className={label} htmlFor="pf-from">Du</label>
        <input id="pf-from" type="date" name="from" defaultValue={values.from ?? ""} className={field} />
      </div>
      <div>
        <label className={label} htmlFor="pf-to">Au</label>
        <input id="pf-to" type="date" name="to" defaultValue={values.to ?? ""} className={field} />
      </div>
      <div>
        <label className={label} htmlFor="pf-q">Référence FedaPay</label>
        <input id="pf-q" name="q" defaultValue={values.q ?? ""} placeholder="trx_…" className={field} />
      </div>
      {pageSize !== undefined && <input type="hidden" name="pageSize" value={pageSize} />}
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-6">
        <button
          type="submit"
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-hover"
        >
          Filtrer
        </button>
        <Link href={resetHref} className="text-sm text-slate-500 hover:text-slate-700 hover:underline">
          Réinitialiser
        </Link>
      </div>
    </form>
  );
}
