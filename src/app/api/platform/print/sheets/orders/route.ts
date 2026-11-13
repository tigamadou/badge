import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { listOrdersWithSheet } from "@/lib/print-sheets/order-queue";

// Commandes avec planche (sous-page « Générées »), rafraîchies toutes les 5 s pendant une génération.
export const GET = withStaffAuth(
  async () => NextResponse.json({ orders: await listOrdersWithSheet() }),
  { permission: "print.sheets.read" },
);
