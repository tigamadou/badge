const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(input: string): string {
  if (!input) return "";
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

// En v2, `smtpFrom` est toujours celui de PlatformSettings (pas de cascade SMTP).
// Le `label` optionnel sert uniquement a habiller l'expediteur affiche avec le nom
// de l'org ou de l'event courant (branding contextuel), sans changer l'adresse reelle.
export function formatFromAddress(smtpFrom: string, label: string | null): string {
  if (!label) return smtpFrom;
  if (smtpFrom.includes("<") && smtpFrom.includes(">")) return smtpFrom;
  const escapedLabel = label.replace(/"/g, '\\"');
  return `"${escapedLabel}" <${smtpFrom}>`;
}

export function formatFrenchDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function buildBaseUrl(env: { BASE_URL?: string; NEXTAUTH_URL?: string }): string {
  const raw = env.BASE_URL || env.NEXTAUTH_URL || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
