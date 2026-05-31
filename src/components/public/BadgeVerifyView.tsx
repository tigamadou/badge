import { formatEventDate } from "@/lib/format-date";

type Props = {
  data:
    | { valid: false; event?: { title: string; date: Date | string } }
    | {
        valid: true;
        event: { title: string; date: Date | string };
        category: { name: string; color: string; anonymous: boolean };
        participant?: { firstName: string; lastName: string; structure: string };
      };
};

export function BadgeVerifyView({ data }: Props) {
  if (!data.valid) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-center">
        <h1 className="text-2xl font-semibold text-red-700">Badge non valide</h1>
        <p className="mt-2 text-sm text-red-700">
          Ce badge n&apos;est pas reconnu comme valide. Présentez-vous à l&apos;accueil.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-6">
      <h1 className="text-2xl font-semibold text-emerald-800">Accès autorisé</h1>
      <p className="mt-1 text-sm text-emerald-800">
        {data.event.title} — {formatEventDate(data.event.date as Date)}
      </p>
      <div
        className="mt-4 inline-flex rounded-full px-3 py-1 text-sm font-medium text-white"
        style={{ backgroundColor: data.category.color }}
      >
        {data.category.name}
      </div>
      {data.participant && (
        <div className="mt-4 text-emerald-900">
          <div className="text-lg font-medium">
            {data.participant.firstName} {data.participant.lastName}
          </div>
          <div className="text-sm">{data.participant.structure}</div>
        </div>
      )}
    </div>
  );
}
