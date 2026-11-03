import Link from "next/link";

type Ref = { id: string; reference: string };

// Liens croisés entre une demande sur place et ses demandes complémentaires.
export function RelatedRequestLinks({
  parent,
  supplements,
  hrefOf,
}: {
  parent: Ref | null;
  supplements: Ref[];
  hrefOf: (requestId: string) => string;
}) {
  if (!parent && supplements.length === 0) return null;
  const cls = "font-medium text-green-700 hover:underline";
  return (
    <ul className="space-y-1 text-sm">
      {parent ? (
        <li>
          <Link href={hrefOf(parent.id)} className={cls}>{`Complément de ${parent.reference}`}</Link>
        </li>
      ) : null}
      {supplements.map((s) => (
        <li key={s.id}>
          <Link href={hrefOf(s.id)} className={cls}>{`Demande complémentaire ${s.reference}`}</Link>
        </li>
      ))}
    </ul>
  );
}
