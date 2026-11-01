import { redirect } from "next/navigation";

// Le template de badge par defaut est desormais un onglet de /platform/settings ;
// cette URL reste valable pour les anciens liens. L'onglet est masque sous STAFF_ADMIN.
export default function StaffBadgeSettingsPage() {
  redirect("/platform/settings?tab=badge");
}
