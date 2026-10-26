// Le format de l'ID d'inscription est imprime sur le badge et encode dans le QR code :
// toute modification doit rester compatible avec generate-id.ts.
import type { Prisma } from "@prisma/client";

import { generateId } from "@/lib/generate-id";

export interface AllocateRegistrationIdArgs {
  eventId: string;
  eventDate: Date;
  categoryId: string;
  categoryNumber: number;
}

// Le client global `prisma` est accepte (assignable a TransactionClient).
export async function allocateRegistrationId(
  tx: Prisma.TransactionClient,
  { eventId, eventDate, categoryId, categoryNumber }: AllocateRegistrationIdArgs,
): Promise<string> {
  const sequential = await tx.registration.count({ where: { eventId, categoryId } });
  const dateIso = eventDate.toISOString().slice(0, 10);

  // Collision retry sur l'ID metier.
  let id = generateId({ categoryNumber, date: dateIso, sequentialNumber: sequential + 1 });
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await tx.registration.findUnique({ where: { id } });
    if (!exists) break;
    id = generateId({
      categoryNumber,
      date: dateIso,
      sequentialNumber: sequential + 1 + attempt + 1,
    });
  }
  return id;
}
