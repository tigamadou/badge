import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

const schema = z.object({
  templateIds: z.array(z.string().min(1)).min(1).max(50),
});

export const POST = withEventAuth({ permission: "event.categories.manage" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const templates = await prisma.categoryTemplate.findMany({
    where: { id: { in: parsed.data.templateIds }, orgId },
  });
  if (templates.length !== parsed.data.templateIds.length) {
    return NextResponse.json({ error: "TEMPLATES_NOT_FOUND_IN_ORG" }, { status: 400 });
  }

  const existing = await prisma.category.findMany({
    where: { eventId },
    select: { number: true, name: true },
  });
  const usedNumbers = new Set(existing.map((c) => c.number));
  const usedNames = new Set(existing.map((c) => c.name));
  let nextFree = 1;
  function allocateNumber(preferred: number): number {
    if (!usedNumbers.has(preferred)) {
      usedNumbers.add(preferred);
      return preferred;
    }
    while (usedNumbers.has(nextFree)) nextFree++;
    usedNumbers.add(nextFree);
    return nextFree++;
  }
  function allocateName(preferred: string): string {
    if (!usedNames.has(preferred)) {
      usedNames.add(preferred);
      return preferred;
    }
    let i = 2;
    while (usedNames.has(`${preferred} (${i})`)) i++;
    const name = `${preferred} (${i})`;
    usedNames.add(name);
    return name;
  }

  const created = await prisma.$transaction(
    templates.map((t) =>
      prisma.category.create({
        data: {
          eventId,
          name: allocateName(t.name),
          color: t.color,
          number: allocateNumber(t.number),
          neutralBadge: t.neutralBadge,
          anonymous: t.anonymous,
        },
      }),
    ),
  );

  for (const c of created) {
    await logActivity({
      type: "CATEGORY_CREATED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: c.id,
      details: { name: c.name, number: c.number, source: "template" },
      req,
    });
  }

  return NextResponse.json({ categories: created }, { status: 201 });
});
