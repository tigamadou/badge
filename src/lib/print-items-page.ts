// Tranche paginee des badges d'une commande d'impression (staff et organisateur).
import type { RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";

export interface PrintItemRow {
  registrationId: string;
  position: number;
  firstName: string;
  lastName: string;
  categoryName: string;
  status: RegistrationStatus;
  badgePrinted: boolean;
}

export interface PrintItemsPage {
  items: PrintItemRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listPrintItemsPage(requestId: string, params: URLSearchParams): Promise<PrintItemsPage> {
  const tokens = (params.get("q") ?? "").trim().split(/\s+/).filter(Boolean);
  const where = {
    requestId,
    ...(tokens.length
      ? {
          registration: {
            AND: tokens.map((t) => ({
              OR: [{ snapshotFirstName: { contains: t } }, { snapshotLastName: { contains: t } }],
            })),
          },
        }
      : {}),
  };
  const result = await paginate(
    parseListPage(params),
    () => prisma.printRequestItem.count({ where }),
    ({ skip, take }) =>
      prisma.printRequestItem.findMany({
        where,
        orderBy: { position: "asc" },
        skip,
        take,
        select: {
          registrationId: true,
          position: true,
          registration: {
            select: {
              snapshotFirstName: true,
              snapshotLastName: true,
              status: true,
              badgePrinted: true,
              category: { select: { name: true } },
            },
          },
        },
      }),
  );
  return {
    items: result.rows.map((i) => ({
      registrationId: i.registrationId,
      position: i.position,
      firstName: i.registration.snapshotFirstName,
      lastName: i.registration.snapshotLastName,
      categoryName: i.registration.category.name,
      status: i.registration.status,
      badgePrinted: i.registration.badgePrinted,
    })),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
}
