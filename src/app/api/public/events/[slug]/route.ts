import { NextResponse } from "next/server";
import { loadPublicEventBySlug, PublicEventError } from "@/lib/public-event";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, "public-event-get");
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limited", code: "RATE_LIMITED" }, { status: 429 });
  }
  try {
    const { event, categories, settings } = await loadPublicEventBySlug(slug);
    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        location: event.location,
        date: event.date,
        logo: event.logo,
        organization: event.organization,
      },
      categories: categories.map((c) => ({
        id: c.id, name: c.name, color: c.color, number: c.number, anonymous: c.anonymous,
      })),
      settings,
    });
  } catch (err) {
    if (err instanceof PublicEventError) {
      const status = err.code === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ error: err.code, code: err.code }, { status });
    }
    throw err;
  }
}
