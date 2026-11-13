import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { parseListPage } from "@/lib/list-query";

// Un brouillon n'est jamais listé : le filtre de statut n'accepte pas DRAFT.
const querySchema = z.object({
  status: z
    .enum(["SUBMITTED", "QUOTED", "ACCEPTED", "PAID", "IN_PRODUCTION", "READY", "COMPLETED", "REJECTED", "CANCELLED"])
    .optional(),
  orgId: z.string().min(1).optional(),
  type: z.enum(["ADVANCE", "ONSITE"]).optional(),
  wantedFrom: z.iso.date().optional(),
  wantedTo: z.iso.date().optional(),
});

export const GET = withStaffAuth(async (req) => {
  const params = Object.fromEntries(
    [...new URL(req.url).searchParams.entries()].filter(([, value]) => value !== ""),
  );
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  const q = parsed.data;
  const { page, pageSize, skip, take } = parseListPage(new URL(req.url).searchParams);

  const wantedBy: Prisma.DateTimeNullableFilter = {};
  if (q.wantedFrom) wantedBy.gte = new Date(`${q.wantedFrom}T00:00:00Z`);
  // Borne haute incluse : toute la journée demandée.
  if (q.wantedTo) wantedBy.lt = new Date(new Date(`${q.wantedTo}T00:00:00Z`).getTime() + 86_400_000);
  const where: Prisma.PrintRequestWhereInput = {
    status: q.status ?? { not: "DRAFT" },
    ...(q.orgId ? { orgId: q.orgId } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.wantedFrom || q.wantedTo ? { wantedBy } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.printRequest.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      skip,
      take,
      select: {
        id: true,
        reference: true,
        type: true,
        status: true,
        delivery: true,
        wantedBy: true,
        estimatedQuantity: true,
        total: true,
        quoteVersion: true,
        submittedAt: true,
        event: { select: { id: true, title: true, date: true } },
        org: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.printRequest.count({ where }),
  ]);

  const requests = rows.map(({ _count, ...r }) => ({
    ...r,
    // Une commande sur place n'a pas d'items : on retombe sur la quantité estimée.
    badgeCount: r.type === "ADVANCE" ? _count.items : (r.estimatedQuantity ?? 0),
  }));
  return NextResponse.json({ requests, total, page, pageSize });
}, { permission: "print.requests.read" });
