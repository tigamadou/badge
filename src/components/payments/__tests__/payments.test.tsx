import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PaymentDetail, PaymentListItem } from "@/lib/payments-query";
import { PaymentFilters } from "../PaymentFilters";
import { PaymentsTable } from "../PaymentsTable";
import { PaymentDetailView } from "../PaymentDetailView";
import { escapeHtml, renderReceiptHtml } from "../receipt";

const norm = (s: string) => s.replace(/[  ]/g, " ").replace(/&#x27;/g, "'");

const item: PaymentListItem = {
  id: "p1",
  createdAt: new Date("2026-10-28T10:00:00Z"),
  approvedAt: new Date("2026-10-28T10:05:00Z"),
  amount: 25000,
  currency: "XOF",
  status: "APPROVED",
  purpose: "SUBSCRIPTION",
  mode: "IMMEDIATE",
  fedapayReference: "trx_42",
  orgId: "o1",
  orgName: "Org Alpha",
  label: "Pro",
  planId: "plan1",
  printRequest: null,
};

const detail: PaymentDetail = {
  ...item,
  listPrice: 45000,
  prorataCredit: 20000,
  coversFrom: new Date("2026-10-28T00:00:00Z"),
  coversTo: new Date("2026-11-27T00:00:00Z"),
  fedapayTransactionId: 4242,
  payerName: "Awa Payeur",
  payerEmail: "awa@example.test",
  plan: { id: "plan1", name: "Pro", period: "MONTHLY" },
};

describe("PaymentsTable", () => {
  const href = (p: PaymentListItem) => `/org/o1/payments/${p.id}`;

  it("lignes : montant FCFA, statut en français, lien Voir", () => {
    const html = norm(renderToStaticMarkup(<PaymentsTable items={[item]} detailHref={href} showOrg={false} />));
    expect(html).toContain("25 000 FCFA");
    expect(html).toContain("Payé");
    expect(html).toContain("Abonnement");
    expect(html).toContain('href="/org/o1/payments/p1"');
    expect(html).toContain("trx_42");
    expect(html).not.toContain("Organisation");
  });

  it("colonne Organisation seulement avec showOrg, avec lien et titre", () => {
    const html = renderToStaticMarkup(
      <PaymentsTable items={[item]} detailHref={href} showOrg orgHref={(p) => `/platform/organizations/${p.orgId}`} />,
    );
    expect(html).toContain("Organisation");
    expect(html).toContain("Org Alpha");
    expect(html).toContain('title="Org Alpha"');
    expect(html).toContain('href="/platform/organizations/o1"');
    const noLink = renderToStaticMarkup(<PaymentsTable items={[item]} detailHref={href} showOrg />);
    expect(noLink).toContain("Org Alpha");
    expect(noLink).not.toContain("/platform/organizations/");
  });

  it("état vide et référence manquante", () => {
    expect(renderToStaticMarkup(<PaymentsTable items={[]} detailHref={href} showOrg={false} />)).toContain("Aucun paiement.");
    expect(renderToStaticMarkup(<PaymentsTable items={[{ ...item, fedapayReference: null }]} detailHref={href} showOrg={false} />)).toContain("—");
  });
});

describe("PaymentFilters", () => {
  it("formulaire GET avec valeurs courantes, pageSize caché et lien de réinitialisation", () => {
    const html = renderToStaticMarkup(
      <PaymentFilters values={{ status: "APPROVED", q: "trx" }} showOrg={false} pageSize={50} resetHref="/org/o1/payments" />,
    );
    expect(html).toContain('method="get"');
    expect(html).toContain('<input type="hidden" name="pageSize" value="50"/>');
    expect(html).toContain('href="/org/o1/payments"');
    expect(html).toContain("Réinitialiser");
    expect(html).toContain('value="trx"');
    expect(html).not.toContain('name="orgQuery"');
    expect(html).not.toContain('name="page"');
  });

  it("champ organisation pour le staff, sans pageSize caché", () => {
    const html = renderToStaticMarkup(<PaymentFilters values={{ orgQuery: "alpha" }} showOrg resetHref="/platform/payments" />);
    expect(html).toContain('name="orgQuery"');
    expect(html).toContain('value="alpha"');
    expect(html).not.toContain('name="pageSize"');
  });

  it("valeurs vides par défaut", () => {
    const html = renderToStaticMarkup(<PaymentFilters values={{}} showOrg resetHref="/x" />);
    expect(html).toContain('name="q"');
  });
});

describe("PaymentDetailView", () => {
  it("abonnement avec prorata : prix plein, crédit, montant payé, période", () => {
    const html = norm(renderToStaticMarkup(<PaymentDetailView payment={detail} showOrg={false} linkTo={{}} />));
    expect(html).toContain("Prix plein");
    expect(html).toContain("45 000 FCFA");
    expect(html).toContain("Crédit déduit");
    expect(html).toContain("− 20 000 FCFA");
    expect(html).toContain("Montant payé");
    expect(html).toContain("Période couverte du 28/10/2026 au 27/11/2026");
    expect(html).toContain("trx_42");
    expect(html).toContain("4242");
    expect(html).toContain("Awa Payeur (awa@example.test)");
    expect(html).toContain("Changement immédiat");
    expect(html).not.toContain("Organisation");
  });

  it("sans prorata (renouvellement, ancien paiement) : pas de bloc crédit", () => {
    const renewal = { ...detail, prorataCredit: 0, listPrice: 25000, mode: "EXTENSION" as const };
    const html = renderToStaticMarkup(<PaymentDetailView payment={renewal} showOrg={false} linkTo={{}} />);
    expect(html).not.toContain("Crédit déduit");
    expect(html).toContain("Période couverte");
    const old = { ...detail, prorataCredit: null, listPrice: null, coversFrom: null, coversTo: null, mode: null };
    const oldHtml = renderToStaticMarkup(<PaymentDetailView payment={old} showOrg={false} linkTo={{}} />);
    expect(oldHtml).not.toContain("Détail de l&#x27;abonnement");
    expect(oldHtml).not.toContain("Changement");
  });

  it("paiement d'impression : lien Commande, pas de bloc plan ni de prorata", () => {
    const print: PaymentDetail = {
      ...detail,
      purpose: "PRINT_REQUEST",
      label: "Impression CMD-1",
      planId: null,
      plan: null,
      mode: null,
      listPrice: null,
      prorataCredit: null,
      coversFrom: null,
      coversTo: null,
      printRequest: { id: "r1", reference: "CMD-1", eventId: "e1" },
    };
    const html = renderToStaticMarkup(
      <PaymentDetailView payment={print} showOrg linkTo={{ order: "/platform/print/orders/r1", org: "/platform/organizations/o1" }} />,
    );
    expect(html).toContain("Commande CMD-1");
    expect(html).toContain('href="/platform/print/orders/r1"');
    expect(html).toContain('href="/platform/organizations/o1"');
    expect(html).not.toContain("Crédit déduit");
    expect(html).not.toContain("Période couverte");
    const noLink = renderToStaticMarkup(<PaymentDetailView payment={print} showOrg linkTo={{}} />);
    expect(noLink).toContain("Commande CMD-1");
    expect(noLink).not.toContain("/platform/print/orders/");
  });

  it("lien vers le plan et paiement sans payeur ni référence", () => {
    const bare = { ...detail, payerName: null, payerEmail: null, fedapayReference: null, fedapayTransactionId: null, approvedAt: null };
    const html = renderToStaticMarkup(<PaymentDetailView payment={bare} showOrg={false} linkTo={{ plan: "/platform/plans" }} />);
    expect(html).toContain('href="/platform/plans"');
    expect(html.match(/—/g)?.length).toBeGreaterThanOrEqual(4);
    const noEmail = renderToStaticMarkup(
      <PaymentDetailView payment={{ ...detail, payerEmail: null }} showOrg={false} linkTo={{}} />,
    );
    expect(noEmail).toContain("Awa Payeur");
    expect(noEmail).not.toContain("(");
  });
});

describe("renderReceiptHtml", () => {
  const issued = new Date("2026-11-04T08:00:00Z");

  it("document autonome avec référence, montant, date, organisation et objet", () => {
    const html = norm(renderReceiptHtml(detail, issued));
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("trx_42");
    expect(html).toContain("25 000 FCFA");
    expect(html).toContain("28/10/2026");
    expect(html).toContain("Org Alpha");
    expect(html).toContain("Abonnement");
    expect(html).toContain("Prix plein");
    expect(html).toContain("− 20 000 FCFA");
    expect(html).toContain("du 28/10/2026 au 27/11/2026");
    expect(html).toContain("Émis le 04/11/2026");
    expect(html).toContain("@page");
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("échappe les contenus saisis", () => {
    const html = renderReceiptHtml(
      { ...detail, orgName: "<script>alert(1)</script>", label: `"><img src=x onerror=1>`, payerName: "A&B" },
      issued,
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("A&amp;B");
  });

  it("paiement d'impression, sans référence, sans mode ni payeur", () => {
    const print: PaymentDetail = {
      ...detail,
      purpose: "PRINT_REQUEST",
      fedapayReference: null,
      mode: null,
      payerName: null,
      payerEmail: null,
      fedapayTransactionId: null,
      approvedAt: null,
      listPrice: null,
      prorataCredit: null,
      coversFrom: null,
      coversTo: null,
      printRequest: { id: "r1", reference: "CMD-9", eventId: "e1" },
    };
    const html = renderReceiptHtml(print, issued);
    expect(html).toContain("Commande CMD-9");
    expect(html).toContain("Impression");
    expect(html).toContain(`<title>Reçu p1</title>`);
    expect(html).not.toContain("Période couverte");
    expect(html).not.toContain("Payeur");
    expect(html).not.toContain("Transaction FedaPay");
    expect(html).not.toContain("Prix plein");
  });

  it("payeur sans e-mail ; renouvellement sans crédit", () => {
    const html = renderReceiptHtml({ ...detail, payerEmail: null, prorataCredit: 0, mode: "EXTENSION" }, issued);
    expect(html).toContain("<dd>Awa Payeur</dd>");
    expect(html).toContain("Renouvellement");
    expect(html).not.toContain("Crédit déduit");
  });

  it("escapeHtml couvre & < > \" '", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
