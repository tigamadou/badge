"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { StaffRole } from "@prisma/client";
import { OnsiteTemplateAlert } from "@/components/print/OnsiteTemplateAlert";
import { PrintRequestStatusBadge } from "@/components/print/PrintRequestStatusBadge";
import { Alert } from "@/components/ui/Feedback";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { PaymentHistory, type PaymentHistoryItem } from "@/components/admin/PaymentHistory";
import { toastApiError } from "@/lib/toast";
import { PRINT_REQUEST_TYPE_LABELS, formatFcfa } from "@/lib/print-requests/labels";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import type { OnsiteCounter } from "@/lib/print-requests/onsite-counter";
import { RelatedRequestLinks } from "@/components/print/RelatedRequestLinks";
import { OnsiteRequestPanel } from "./OnsiteRequestPanel";
import { RequestCreditPanel, type StaffCreditData } from "./RequestCreditPanel";
import { QuoteEditor } from "./QuoteEditor";
import { RequestStatusActions } from "./RequestStatusActions";
import { PrintThread } from "@/components/print/PrintThread";
import { canEditQuote, formatBadgeSize } from "./request-actions";
import { requestUrl } from "./request-fetch";
import type { ProductOption, RequestDetailData } from "./request-types";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-800">{children || "—"}</dd>
    </div>
  );
}

const GENERATION_LABEL = { PENDING: "En attente", RUNNING: "En cours", DONE: "Terminée", FAILED: "Échec" } as const;

export function RequestDetail({
  requestId,
  role,
  products,
  payments = [],
  onsiteCounter = null,
  credit = null,
  parentRequest = null,
  supplements = [],
}: {
  requestId: string;
  role: StaffRole;
  products: ProductOption[];
  payments?: PaymentHistoryItem[];
  onsiteCounter?: OnsiteCounter | null;
  credit?: StaffCreditData | null;
  parentRequest?: { id: string; reference: string } | null;
  supplements?: { id: string; reference: string }[];
}) {
  const router = useRouter();
  const [data, setData] = useState<RequestDetailData | null>(null);
  const [failed, setFailed] = useState(false);
  const [threadKey, setThreadKey] = useState(0);
  const [showBadges, setShowBadges] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(requestUrl(requestId));
      if (!res.ok) throw res;
      setData((await res.json()) as RequestDetailData);
      setFailed(false);
    } catch (err) {
      await toastApiError(err);
      setFailed(true);
    }
  }, [requestId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial
    void load();
  }, [load]);

  // Après une action : recharge la commande et le fil, et le compteur du menu (layout serveur).
  const onChanged = useCallback(() => {
    void load();
    setThreadKey((k) => k + 1);
    router.refresh();
  }, [load, router]);

  if (!data) {
    return failed ? (
      <Alert tone="err">Cette commande est introuvable ou inaccessible.</Alert>
    ) : (
      <p className="text-sm text-slate-400">Chargement…</p>
    );
  }

  const { request, event, template, items, lines, generations, onsiteTemplate } = data;
  const printed = items.filter((i) => i.badgePrinted).length;
  const canPost = staffRoleAtLeast(role, "STAFF_SUPPORT");

  return (
    <div className="space-y-4">
      <div>
        <Link href="/platform/print/orders" className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800">
          <Icon name="arrow-left" size={14} /> Commandes
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{request.reference}</h1>
          <PrintRequestStatusBadge status={request.status} />
          <span className="text-sm text-slate-500">{PRINT_REQUEST_TYPE_LABELS[request.type]}</span>
        </div>
        <p className="mt-0.5 text-sm text-slate-400">
          Envoyée le {request.submittedAt ? dateTimeFmt.format(new Date(request.submittedAt)) : "—"} · Total{" "}
          {formatFcfa(request.total)}
        </p>
      </div>

      <RelatedRequestLinks
        parent={parentRequest}
        supplements={supplements}
        hrefOf={(id) => `/platform/print/orders/${id}`}
      />

      {onsiteTemplate === "UNSUITABLE" && <OnsiteTemplateAlert side="STAFF" eventId={event.id} />}

      <RequestStatusActions
        request={request}
        eventId={event.id}
        orgId={event.org.id}
        items={items}
        role={role}
        onChanged={onChanged}
      />

      {credit && (
        <RequestCreditPanel requestId={requestId} status={request.status} role={role} credit={credit} onChanged={onChanged} />
      )}

      {onsiteCounter && (
        <OnsiteRequestPanel requestId={requestId} status={request.status} role={role} initialCounter={onsiteCounter} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="Évènement" />
          <CardBody>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Titre">{event.title}</Field>
              <Field label="Organisation">{event.org.name}</Field>
              <Field label="Dates">
                {fmtDate(event.date)}
                {event.endDate ? ` → ${fmtDate(event.endDate)}` : ""}
              </Field>
              <Field label="Lieu">{event.location}</Field>
              <Field label="E-mail de contact">{event.org.contactEmail}</Field>
              <Field label="Téléphone de contact">{event.org.contactPhone}</Field>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Template et épreuve" />
          <CardBody>
            {template ? (
              <div className="flex flex-wrap items-start gap-4">
                <dl className="grid flex-1 gap-3 sm:grid-cols-2">
                  <Field label="Template">{template.label}</Field>
                  <Field label="Format">{formatBadgeSize(template.widthPx, template.heightPx)}</Field>
                  <Field label="Pages">{String(template.pages)}</Field>
                </dl>
                {template.proofPath && (
                  // eslint-disable-next-line @next/next/no-img-element -- épreuve servie par /api/files
                  <img
                    src={`/api/files/${template.proofPath}`}
                    alt={`Épreuve du template ${template.label}`}
                    className="max-h-40 rounded-lg border border-slate-200"
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Aucun template.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHead title="Livraison et informations" />
        <CardBody>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Date souhaitée">{fmtDate(request.wantedBy)}</Field>
            {request.type === "ADVANCE" ? (
              <>
                <Field label="Mode">
                  {request.delivery === "DELIVERY" ? "Livraison" : request.delivery === "PICKUP" ? "Retrait" : ""}
                </Field>
                <Field label="Adresse">{request.deliveryAddress}</Field>
                <Field label="Contact">
                  {[request.deliveryContactName, request.deliveryContactPhone].filter(Boolean).join(" · ")}
                </Field>
              </>
            ) : (
              <>
                <Field label="Quantité estimée">{request.estimatedQuantity?.toString() ?? ""}</Field>
                <Field label="Lieu sur place">{request.onsiteLocation}</Field>
                <Field label="Contact sur place">
                  {[request.onsiteContactName, request.onsiteContactPhone].filter(Boolean).join(" · ")}
                </Field>
              </>
            )}
            <Field label="Remarques">
              {/* Texte brut, retours à la ligne conservés. */}
              <span className="whitespace-pre-wrap">{request.notes}</span>
            </Field>
          </dl>
        </CardBody>
      </Card>

      {request.type === "ADVANCE" && (
        <Card>
          <CardHead
            title="Badges"
            subtitle={`${items.length} badge${items.length > 1 ? "s" : ""} · ${printed} imprimé${printed > 1 ? "s" : ""}`}
            action={
              items.length > 0 ? (
                <button
                  type="button"
                  aria-expanded={showBadges}
                  onClick={() => setShowBadges((v) => !v)}
                  className="text-[13px] font-medium text-green-700 hover:underline"
                >
                  {showBadges ? "Replier la liste" : "Afficher la liste"}
                </button>
              ) : undefined
            }
          />
          {showBadges && (
            <CardBody className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-medium">Nom</th>
                    <th className="px-3 py-2 font-medium">Catégorie</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                    <th className="px-3 py-2 font-medium">Imprimé</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.registrationId} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        {i.firstName} {i.lastName}
                      </td>
                      <td className="px-3 py-2">{i.categoryName}</td>
                      <td className="px-3 py-2">{i.status}</td>
                      <td className="px-3 py-2">{i.badgePrinted ? "Oui" : "Non"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          )}
        </Card>
      )}

      <QuoteEditor
        requestId={requestId}
        lines={lines}
        canEdit={canEditQuote(request.status, role)}
        products={products}
        onChanged={onChanged}
      />

      {generations.length > 0 && (
        <Card>
          <CardHead title="Générations de planches" />
          <CardBody>
            <ul className="divide-y divide-slate-100 text-sm">
              {generations.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span>{dateTimeFmt.format(new Date(g.createdAt))}</span>
                  <span className="text-slate-500">{GENERATION_LABEL[g.status]}</span>
                  <span className="text-slate-500">
                    {g.badgeCount} badge{g.badgeCount > 1 ? "s" : ""}
                    {g.sheetCount != null ? ` · ${g.sheetCount} planche${g.sheetCount > 1 ? "s" : ""}` : ""}
                  </span>
                  {g.status === "DONE" && (
                    <a
                      href={`/api/files/${g.fileKey ?? `print-sheets/${g.id}.pdf`}`}
                      download={`planches-${g.id}.pdf`}
                      className="ml-auto text-[13px] font-medium text-green-600 hover:underline"
                    >
                      Télécharger
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {payments.length > 0 && (
        <Card>
          <CardHead title="Paiements" />
          <CardBody>
            <PaymentHistory payments={payments} />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHead title="Échanges" subtitle="Messages avec l'organisateur et historique de la commande" />
        <CardBody>
          <PrintThread
            entriesUrl={requestUrl(requestId, "/messages")}
            postUrl={canPost ? requestUrl(requestId, "/messages") : null}
            uploadUrl={canPost ? `/api/platform/upload?context=print-request&requestId=${requestId}` : null}
            placeholder="Écrire à l'organisateur…"
            refreshKey={threadKey}
          />
        </CardBody>
      </Card>
    </div>
  );
}
