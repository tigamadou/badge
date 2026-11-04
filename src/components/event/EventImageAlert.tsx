import Link from "next/link";
import { Alert } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { SLOT_LABEL, type ImageIssue } from "@/lib/event-image-compliance";

// Bandeau « images à recadrer » : visible tant que le logo ou la bannière ne respecte pas
// le cadre du template effectif (la génération des badges est alors bloquée).
export function EventImageAlert({
  eventId,
  issues,
}: {
  eventId: string;
  issues: Pick<ImageIssue, "slot" | "message">[];
}) {
  if (issues.length === 0) return null;
  return (
    <Alert tone="warn">
      <Icon name="alert-triangle" size={16} />
      <div className="min-w-0">
        <p>
          <strong className="font-semibold">Images à recadrer :</strong>
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {issues.map((issue) => (
            <li key={issue.slot}>
              {SLOT_LABEL[issue.slot]} — {issue.message}
            </li>
          ))}
        </ul>
        <p className="mt-1">
          La génération des badges est bloquée tant qu&apos;elles ne sont pas conformes.{" "}
          <Link href={`/event/${eventId}/settings`} className="font-medium underline">
            Recadrer dans les paramètres
          </Link>
        </p>
      </div>
    </Alert>
  );
}
