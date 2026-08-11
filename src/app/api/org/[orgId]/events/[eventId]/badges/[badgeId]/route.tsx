import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { withEventAuth } from "@/lib/with-event-auth";
import { prisma } from "@/lib/prisma";
import { resolveBadgeTemplateId } from "@/lib/settings";
import { DEFAULT_TEMPLATE_ID } from "@/lib/badge-templates";
import { resolveTemplate } from "@/lib/badge-templates/resolve";
import { buildTemplateContext } from "@/lib/badge-templates/build-context";

export const runtime = "nodejs";

type Params = { orgId: string; eventId: string; badgeId: string };

// Lit le badgeTemplateId de PlatformSettings (singleton).
async function getPlatformBadgeTemplateId(): Promise<{ badgeTemplateId: string }> {
  const platform = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { badgeTemplateId: true },
  });
  if (!platform) {
    return { badgeTemplateId: DEFAULT_TEMPLATE_ID };
  }
  return platform;
}

// Garde par la permission atomique `badge.print` (cf. matrice multi-tenancy-rbac.md).
// Auparavant `minRole: "VIEWER"` verrouillait en amont et rejetait un PRINTER pur
// avant meme le check de permission — la hierarchie de roles ne satisfait jamais
// PRINTER. La permission est la source de verite.
export const GET = withEventAuth(
  { permission: "badge.print", allowArchived: true },
  async (_req, { orgId: _orgId, eventId }, extra) => {
    const { badgeId } = (await extra.params) as Params;

    const registration = await prisma.registration.findUnique({
      where: { id: badgeId },
      include: {
        event: { select: { id: true, title: true, date: true, location: true, logo: true, badgeTemplateId: true, orgId: true } },
        category: {
          select: { name: true, color: true, neutralBadge: true, anonymous: true },
        },
      },
    });
    if (!registration || registration.eventId !== eventId) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const [organization, platform] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: registration.event.orgId },
        select: { badgeTemplateId: true },
      }),
      getPlatformBadgeTemplateId(),
    ]);

    const resolvedId = resolveBadgeTemplateId(
      { badgeTemplateId: registration.event.badgeTemplateId },
      organization,
      platform,
    );
    // resolveTemplate porte deja le repli sur le template par defaut et sa
    // journalisation, pour le registre compile comme pour le catalogue installe.
    const template = await resolveTemplate(resolvedId);

    const templateCtx = await buildTemplateContext({
      id: registration.id,
      snapshotFirstName: registration.snapshotFirstName,
      snapshotLastName: registration.snapshotLastName,
      snapshotStructure: registration.snapshotStructure,
      snapshotPhoto: registration.snapshotPhoto,
      event: {
        title: registration.event.title,
        date: registration.event.date,
        location: registration.event.location,
        logo: registration.event.logo,
      },
      category: registration.category,
    });

    const Component = template.Component;
    const stream = await renderToStream(<Component ctx={templateCtx} />);
    // ReadableStream Web compatible : le `Response` Next.js accepte un stream Node
    // wrappe. On streame en TransformStream pour rester non-bloquant.
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk)));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="badge-${registration.id}.pdf"`,
        "x-template-id": template.meta.id,
      },
    });
  },
);
