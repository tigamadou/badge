import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { CatPill, Tag } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";
import { formatEventPeriod } from "@/lib/format-date";

type EventInfo = {
  title: string;
  date: Date | string;
  endDate: Date | string | null;
  location: string;
  description: string | null;
  registrationOpen: boolean;
};

type CategoryInfo = { id: string; name: string; color: string };

export function EventInfoCard({
  event,
  categories,
  variant,
}: {
  event: EventInfo;
  categories: CategoryInfo[];
  variant: "public" | "staff";
}) {
  return (
    <Card>
      <CardHead
        title="Informations de l'événement"
        action={
          variant === "staff" ? (
            <Tag icon={event.registrationOpen ? "check" : "x"}>
              {event.registrationOpen ? "Inscriptions ouvertes" : "Inscriptions fermées"}
            </Tag>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          <span className="flex items-center gap-1.5">
            <Icon name="clock" size={15} />
            {formatEventPeriod(event.date, event.endDate)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1.5">
              <Icon name="map-pin" size={15} />
              {event.location}
            </span>
          )}
        </div>

        {event.description && (
          <p className="whitespace-pre-line text-sm text-slate-700">{event.description}</p>
        )}

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <CatPill key={c.id} color={c.color} label={c.name} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
