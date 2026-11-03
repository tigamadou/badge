import { listOrdersToGenerate } from "@/lib/print-sheets/order-queue";
import { OrderQueueTable } from "@/components/staff/print/sheets/OrderQueueTable";
import { loadLayoutOptions, requireSheetsStaff } from "../sheets-data";

export const dynamic = "force-dynamic";

export default async function PendingSheetsPage() {
  await requireSheetsStaff();
  const [orders, layouts] = await Promise.all([listOrdersToGenerate(), loadLayoutOptions()]);
  return <OrderQueueTable mode="pending" initial={orders} layouts={layouts} />;
}
