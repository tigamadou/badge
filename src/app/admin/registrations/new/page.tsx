"use client";

import { useRouter } from "next/navigation";
import { RegistrationForm } from "@/components/admin/RegistrationForm";

export default function NewRegistrationPage() {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const photoFile = formData.get("photo") as File | null;
    const idDocumentFile = formData.get("idDocument") as File | null;

    const body: Record<string, string> = {
      lastName: formData.get("lastName") as string,
      firstName: formData.get("firstName") as string,
      email: formData.get("email") as string,
      structure: formData.get("structure") as string,
      teamId: formData.get("teamId") as string,
      idDocumentType: formData.get("idDocumentType") as string,
      idDocumentNumber: formData.get("idDocumentNumber") as string,
    };

    const res = await fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const registration = await res.json();
    const patches: Record<string, string> = {};

    if (photoFile && photoFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", photoFile);
      uploadData.append("type", "photo");
      uploadData.append("registrationId", registration.id);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
      if (uploadRes.ok) {
        const { path } = await uploadRes.json();
        patches.photo = path;
      }
    }

    if (idDocumentFile && idDocumentFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", idDocumentFile);
      uploadData.append("type", "idDocument");
      uploadData.append("registrationId", registration.id);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
      if (uploadRes.ok) {
        const { path } = await uploadRes.json();
        patches.idDocument = path;
      }
    }

    if (Object.keys(patches).length > 0) {
      await fetch(`/api/registrations/${registration.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patches),
      });
    }

    router.push("/admin/registrations");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Nouvelle inscription</h1>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg">
        <RegistrationForm onSubmit={handleSubmit} submitLabel="Créer l'inscription" />
      </div>
    </div>
  );
}
