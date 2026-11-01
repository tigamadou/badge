import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { prisma } from "@/lib/prisma";
import { RequestDetail } from "@/components/staff/print/RequestDetail";

export default async function PrintRequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  // Le layout /platform garantit déjà un membre du staff ; cette garde sert le typage.
  if (!ctx || !ctx.isStaff || !ctx.staffRole) notFound();

  // Produits proposés à l'ajout d'une ligne produit (STAFF_ADMIN seulement).
  const products =
    ctx.staffRole === "STAFF_ADMIN" || ctx.staffRole === "SUPER_ADMIN"
      ? await prisma.printProduct.findMany({
          where: { archived: false },
          orderBy: [{ position: "asc" }, { name: "asc" }],
          select: { id: true, name: true, basePrice: true },
        })
      : [];

  return <RequestDetail requestId={requestId} role={ctx.staffRole} products={products} />;
}
