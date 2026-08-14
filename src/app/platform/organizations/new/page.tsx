import { OrgCreationForm } from "@/components/staff/OrgCreationForm";

export default function NewOrganizationPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nouvelle organisation</h1>
      <OrgCreationForm />
    </div>
  );
}
