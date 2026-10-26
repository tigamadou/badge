// Portées des notifications : module pur, sans Prisma, importable côté client.

export type NotificationScopeRef =
  | { kind: "platform" }
  | { kind: "org"; orgId: string }
  | { kind: "event"; eventId: string }
  | { kind: "participant" };

export function parseScopeQuery(params: URLSearchParams): NotificationScopeRef | null {
  switch (params.get("scope")) {
    case "platform":
      return { kind: "platform" };
    case "participant":
      return { kind: "participant" };
    case "org": {
      const orgId = params.get("orgId");
      return orgId ? { kind: "org", orgId } : null;
    }
    case "event": {
      const eventId = params.get("eventId");
      return eventId ? { kind: "event", eventId } : null;
    }
    default:
      return null;
  }
}

export function scopeToSearchParams(ref: NotificationScopeRef): URLSearchParams {
  const params = new URLSearchParams({ scope: ref.kind });
  if (ref.kind === "org") params.set("orgId", ref.orgId);
  if (ref.kind === "event") params.set("eventId", ref.eventId);
  return params;
}

export function notificationsPagePath(ref: NotificationScopeRef): string {
  switch (ref.kind) {
    case "platform":
      return "/platform/notifications";
    case "org":
      return `/org/${encodeURIComponent(ref.orgId)}/notifications`;
    case "event":
      return `/event/${encodeURIComponent(ref.eventId)}/notifications`;
    case "participant":
      return "/account/notifications";
  }
}
