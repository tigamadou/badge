import { OrgCreationForm } from "@/components/staff/OrgCreationForm";
import { requirePlatformPage } from "../../page-guard";

export default async function NewOrganizationPage() {
  await requirePlatformPage("organizations.create", "/platform/organizations/new");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nouvelle organisation</h1>
      <OrgCreationForm />
    </div>
  );
}
