import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

// Liens autorisés : http, https, mailto et liens relatifs (jamais javascript:, data:, etc.).
md.validateLink = (url: string) => /^(https?:|mailto:)/i.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url.trim());

md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const href = String(tokens[idx].attrGet("href"));
  if (/^https?:/i.test(href)) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  return self.renderToken(tokens, idx, options);
};

/** Rendu Markdown sans HTML brut ; les corps viennent du dépôt mais sont traités comme non fiables. */
export function renderDocHtml(markdown: string): string {
  return md.render(markdown);
}
