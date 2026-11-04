import type { NotificationLink } from "./types";

export type BodySegment = { text: string; href?: string };

// Découpe le body en segments : la première occurrence de chaque ancre de lien devient un
// segment cliquable. Une ancre absente du body, ou déjà couverte par une autre ancre, est ignorée.
export function splitBodyByAnchors(body: string, links: NotificationLink[]): BodySegment[] {
  const found: { start: number; end: number; href: string }[] = [];
  for (const l of links) {
    if (!l.anchor) continue;
    const start = body.indexOf(l.anchor);
    if (start === -1) continue;
    const end = start + l.anchor.length;
    if (found.some((f) => start < f.end && end > f.start)) continue;
    found.push({ start, end, href: l.href });
  }
  found.sort((a, b) => a.start - b.start);
  const segments: BodySegment[] = [];
  let cursor = 0;
  for (const f of found) {
    if (f.start > cursor) segments.push({ text: body.slice(cursor, f.start) });
    segments.push({ text: body.slice(f.start, f.end), href: f.href });
    cursor = f.end;
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor) });
  if (segments.length === 0) segments.push({ text: body });
  return segments;
}

export function isAnchored(body: string, link: NotificationLink | undefined): boolean {
  return !!link?.anchor && body.includes(link.anchor);
}
