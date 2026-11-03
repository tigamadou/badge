import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

// L'observateur n'a pas accès à la génération (STAFF_SUPPORT minimum).
export async function requireSheetsStaff(): Promise<void> {
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  if (!ctx || !ctx.isStaff || !ctx.staffRole || !staffRoleAtLeast(ctx.staffRole, "STAFF_SUPPORT")) {
    redirect("/platform");
  }
}

// Gabarits proposables (non archivés).
export function loadLayoutOptions() {
  return prisma.printSheetLayout.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sheetWidth: true,
      sheetHeight: true,
      sheetOrientation: true,
      marginTop: true,
      marginRight: true,
      marginBottom: true,
      marginLeft: true,
      gapHorizontal: true,
      gapVertical: true,
      badgeOrientation: true,
      duplexFlip: true,
      cropMarks: true,
    },
  });
}
