import { listOrdersWithSheet } from "@/lib/print-sheets/order-queue";
import { OrderQueueTable } from "@/components/staff/print/sheets/OrderQueueTable";
import { loadLayoutOptions, requireSheetsStaff } from "../sheets-data";

export const dynamic = "force-dynamic";

export default async function GeneratedSheetsPage() {
  await requireSheetsStaff();
  const [orders, layouts] = await Promise.all([listOrdersWithSheet(), loadLayoutOptions()]);
  return <OrderQueueTable mode="generated" initial={orders} layouts={layouts} />;
}
