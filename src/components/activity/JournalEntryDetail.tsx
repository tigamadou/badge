import Link from "next/link";
import type { ActivityType } from "@prisma/client";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { LogType, KeyValue, Diff, Payload } from "@/components/ui/JournalBlocks";
import { RoleBadge } from "@/components/ui/Labels";
import { OrgLogo } from "@/components/ui/PickCard";
import { Icon } from "@/components/ui/Icon";
import { logKind, describeActivity, extractDiff } from "@/lib/activity-labels";
import { JournalEntryActions } from "./JournalEntryActions";

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

export type JournalEntry = {
  id: string;
  type: ActivityType;
  createdAt: Date;
  staffActor: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  details: unknown;
  targetId: string | null;
  user: { id: string; name: string | null; email: string; staffRole?: StaffRoleStr | null; platformRole?: { name: string } | null } | null;
};

// Vue detail d'une entree de journal (lecture seule), partagee staff / org / event.
export function JournalEntryDetail({
  log,
  org,
  event,
  backHref,
  backLabel,
}: {
  log: JournalEntry;
  org?: { id: string; name: string; slug: string } | null;
  event?: { id: string; title: string; slug: string; orgId: string } | null;
  backHref: string;
  backLabel: string;
}) {
  const diff = extractDiff(log.details);
  const json = JSON.stringify(log.details ?? {}, null, 2);

  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-600">
        <Icon name="arrow-left" size={13} /> {backLabel}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <LogType kind={logKind(log.type)}>{log.type}</LogType>
            <span className="font-mono text-[13px] text-slate-400">ENTRÉE #{log.id}</span>
          </div>
          <h1 className="text-xl font-semibold text-navy">{describeActivity(log.type)}</h1>
          <p className="mt-0.5 text-sm text-slate-400">{new Date(log.createdAt).toLocaleString("fr-FR")}</p>
        </div>
        <JournalEntryActions id={log.id} json={json} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHead title="Détails de l'action" />
            <CardBody>
              <KeyValue
                items={[
                  { label: "Type", value: <LogType kind={logKind(log.type)}>{log.type}</LogType> },
                  { label: "Auteur", value: log.user?.email ?? "Système" },
                  { label: "Contexte", value: org?.name ?? event?.title ?? "—" },
                  { label: "Staff", value: log.staffActor ? "Oui" : "Non" },
                ]}
              />
            </CardBody>
          </Card>

          {diff.length > 0 && (
            <Card>
              <CardHead title="Modification" subtitle="Valeur avant / après" />
              <CardBody className="space-y-4">
                {diff.map((d) => (
                  <div key={d.field}>
                    <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-400">{d.field}</div>
                    <Diff
                      oldValue={<span className="font-mono">{d.from}</span>}
                      newValue={<span className="font-mono">{d.to}</span>}
                    />
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHead title="Charge utile brute" subtitle="Données techniques de l'événement" />
            <CardBody>
              <Payload json={json} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHead title="Auteur" />
            <CardBody>
              {log.user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{log.user.name ?? log.user.email}</span>
                    {(log.user.platformRole?.name ?? log.user.staffRole) && (
                      <RoleBadge tone="navy">{log.user.platformRole?.name ?? log.user.staffRole}</RoleBadge>
                    )}
                  </div>
                  <KeyValue
                    items={[
                      { label: "E-mail", value: log.user.email },
                      ...(log.ipAddress ? [{ label: "IP", value: <span className="font-mono">{log.ipAddress}</span> }] : []),
                    ]}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-400">Action système</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Contexte" />
            <CardBody className="space-y-3">
              {org && (
                <Link
                  href={`/platform/organizations/${org.id}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-slate-300"
                >
                  <OrgLogo name={org.name} size={30} />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{org.name}</div>
                    <div className="font-mono text-xs text-slate-400">{org.slug}</div>
                  </div>
                </Link>
              )}
              {event && (
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-sm font-medium text-slate-900">{event.title}</div>
                  <div className="font-mono text-xs text-slate-400">{event.slug}</div>
                </div>
              )}
              {log.targetId && (
                <div className="text-[13px] text-slate-400">
                  Cible : <span className="font-mono text-slate-600">{log.targetId}</span>
                </div>
              )}
              {!org && !event && !log.targetId && <p className="text-sm text-slate-400">Aucun contexte associé.</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
