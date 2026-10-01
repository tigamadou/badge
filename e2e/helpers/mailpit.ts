// Mailpit est accessible depuis le container `app` via http://mailpit:8025.
// L'API REST est documentee : https://github.com/axllent/mailpit/wiki/HTTP-API.
// On utilise fetch global (Node 20+). Pas de dependance externe.
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://mailpit:8025";

export type MailpitAddress = { Address: string; Name: string };

export type MailpitMessage = {
  ID: string;
  From: MailpitAddress;
  To: MailpitAddress[];
  Subject: string;
  Snippet: string;
  Created: string;
};

type SearchResponse = {
  messages: MailpitMessage[];
  total?: number;
  unread?: number;
  count?: number;
  messages_count?: number;
};

type MessageBody = {
  ID: string;
  HTML: string;
  Text: string;
  Subject: string;
  From: MailpitAddress;
  To: MailpitAddress[];
};

function buildSearchQuery(opts: { to?: string; subject?: string }): string {
  const parts: string[] = [];
  if (opts.to) parts.push(`to:${opts.to}`);
  if (opts.subject) parts.push(`subject:${opts.subject}`);
  return parts.join(" ");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`mailpit: ${init?.method ?? "GET"} ${url} -> ${res.status}`);
  }
  return (await res.json()) as T;
}

export const mailpit = {
  async clear(): Promise<void> {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
    if (!res.ok) {
      throw new Error(`mailpit.clear failed: ${res.status}`);
    }
  },

  async search(opts: { to?: string; subject?: string }): Promise<MailpitMessage[]> {
    const query = buildSearchQuery(opts);
    if (!query) return [];
    const url = `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`;
    const data = await fetchJson<SearchResponse>(url);
    return data.messages ?? [];
  },

  async getBody(messageId: string): Promise<{ HTML: string; Text: string }> {
    const url = `${MAILPIT_URL}/api/v1/message/${encodeURIComponent(messageId)}`;
    const data = await fetchJson<MessageBody>(url);
    return { HTML: data.HTML ?? "", Text: data.Text ?? "" };
  },

  // Poll mailpit jusqu'a trouver un message qui matche tous les filtres ou
  // jusqu'au timeout (defaut 5000 ms, intervalle 250 ms). Throw avec un message
  // clair (filtres dumpes) si aucun match.
  async expectMail(opts: {
    to: string;
    subjectPattern?: RegExp;
    bodyPattern?: RegExp;
    timeoutMs?: number;
  }): Promise<MailpitMessage> {
    const timeoutMs = opts.timeoutMs ?? 5000;
    const intervalMs = 250;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const messages = await this.search({ to: opts.to });
      for (const msg of messages) {
        if (opts.subjectPattern && !opts.subjectPattern.test(msg.Subject)) continue;
        if (opts.bodyPattern) {
          const body = await this.getBody(msg.ID);
          if (!opts.bodyPattern.test(body.Text) && !opts.bodyPattern.test(body.HTML)) {
            continue;
          }
        }
        return msg;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(
      `mailpit.expectMail timeout (${timeoutMs} ms) : aucun mail trouve pour ` +
        JSON.stringify({
          to: opts.to,
          subjectPattern: opts.subjectPattern?.source,
          bodyPattern: opts.bodyPattern?.source,
        }),
    );
  },
};
