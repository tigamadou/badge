import { Timeline, TimelineItem } from "@/components/ui/Timeline";

type Snapshot = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  structure: string;
  idDocumentNumber: string;
  createdAt: string;
};

export function RegistrationHistory({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) {
    return <p className="text-sm text-slate-400">Aucune modification antérieure.</p>;
  }
  return (
    <Timeline>
      {snapshots.map((s) => (
        <TimelineItem
          key={s.id}
          title={`${s.firstName} ${s.lastName}`}
          meta={`${new Date(s.createdAt).toLocaleString("fr-FR")} · ${s.email} — ${s.structure} — Doc ${s.idDocumentNumber}`}
        />
      ))}
    </Timeline>
  );
}
