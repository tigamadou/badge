import Link from "next/link";
import { Alert } from "@/components/ui/Feedback";

// Template devenu inadapté à l'impression sur place : l'avancement de la demande est bloqué.
export function OnsiteTemplateAlert({ side, eventId }: { side: "ORGANIZER" | "STAFF"; eventId: string }) {
  if (side === "STAFF") {
    return (
      <Alert tone="warn">
        Template non adapté : l&apos;avancement est bloqué jusqu&apos;au retour à un template adapté.
      </Alert>
    );
  }
  return (
    <Alert tone="warn">
      <span>
        Le modèle de badge choisi n&apos;est pas adapté à l&apos;impression sur place. L&apos;équipe Badge ne peut pas
        avancer cette demande.{" "}
        <Link href={`/event/${eventId}/settings/badge`} className="font-medium underline">
          Changer le modèle de badge
        </Link>
      </span>
    </Alert>
  );
}
