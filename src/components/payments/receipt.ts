import { BRAND } from "@/lib/brand-colors";
import type { PaymentDetail } from "@/lib/payments-query";
import { MODE_LABELS, PURPOSE_LABELS, fcfa, fmtDate } from "./status";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `
*{box-sizing:border-box}
body{margin:0;padding:32px 16px;background:${BRAND.mist};color:#0f172a;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.sheet{max-width:640px;margin:0 auto;background:#fff;border:1px solid ${BRAND.line};border-radius:12px;padding:32px}
h1{margin:0 0 4px;font-size:22px}
.muted{color:#64748b}
dl{display:grid;grid-template-columns:180px 1fr;margin:24px 0 0}
dt,dd{margin:0;padding:10px 0;border-bottom:1px solid ${BRAND.line}}
dt{color:#64748b}
.total{margin-top:24px;display:flex;justify-content:space-between;font-size:18px;font-weight:600}
.actions{max-width:640px;margin:16px auto 0;text-align:right}
button{border:0;border-radius:8px;background:${BRAND.navy};color:#fff;padding:10px 18px;font-size:14px;cursor:pointer}
@page{margin:16mm}
@media print{body{background:#fff;padding:0}.sheet{border:0;padding:0;max-width:none}.actions{display:none}}
@media (max-width:480px){dl{grid-template-columns:1fr}dt{border-bottom:0;padding-bottom:0}}
`;

// Reçu d'un paiement approuvé : document HTML autonome (pas de ressource distante), construit à la
// main plutôt que par react-dom/server, que Next refuse dans un route handler. Toute valeur saisie
// (nom d'organisation, libellé du plan, payeur) passe par escapeHtml.
export function renderReceiptHtml(payment: PaymentDetail, issuedAt: Date): string {
  const rows: [string, string][] = [
    ["Référence", payment.fedapayReference ?? payment.id],
    ["Date du paiement", fmtDate(payment.approvedAt ?? payment.createdAt)],
    ["Organisation", payment.orgName],
    ["Type", PURPOSE_LABELS[payment.purpose]],
    ["Objet", payment.printRequest ? `Commande ${payment.printRequest.reference}` : payment.label],
  ];
  if (payment.mode) rows.push(["Changement", MODE_LABELS[payment.mode]]);
  if (payment.purpose === "SUBSCRIPTION" && payment.coversFrom && payment.coversTo) {
    rows.push(["Période couverte", `du ${fmtDate(payment.coversFrom)} au ${fmtDate(payment.coversTo)}`]);
  }
  if (payment.purpose === "SUBSCRIPTION" && (payment.prorataCredit ?? 0) > 0 && payment.listPrice !== null) {
    rows.push(["Prix plein", fcfa(payment.listPrice)], ["Crédit déduit", `− ${fcfa(payment.prorataCredit as number)}`]);
  }
  if (payment.payerName) {
    rows.push(["Payeur", payment.payerEmail ? `${payment.payerName} (${payment.payerEmail})` : payment.payerName]);
  }
  if (payment.fedapayTransactionId !== null) rows.push(["Transaction FedaPay", String(payment.fedapayTransactionId)]);

  const list = rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Reçu ${escapeHtml(payment.fedapayReference ?? payment.id)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="sheet">
<h1>Reçu de paiement</h1>
<p class="muted">Émis le ${escapeHtml(fmtDate(issuedAt))}</p>
<dl>${list}</dl>
<div class="total"><span>Montant payé</span><span>${escapeHtml(fcfa(payment.amount))}</span></div>
</div>
<div class="actions"><button type="button" id="print-receipt">Imprimer</button></div>
<script>document.getElementById("print-receipt").addEventListener("click",function(){window.print()})</script>
</body>
</html>`;
}
