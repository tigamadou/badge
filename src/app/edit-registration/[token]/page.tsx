"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RegistrationForm } from "@/components/admin/RegistrationForm";
import { Button } from "@/components/ui/Button";

interface RegistrationData {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  structure: string;
  teamId: string;
  idDocumentType: string;
  idDocumentNumber: string;
  photo: string | null;
  idDocument: string | null;
  rejectionReason: string | null;
  rejectionDetails: string | null;
}

export default function EditRegistrationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [registration, setRegistration] = useState<RegistrationData | null>(null);
  const [expired, setExpired] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/edit-registration/${token}`)
      .then(async (res) => {
        if (res.status === 410) {
          setExpired(true);
          return;
        }
        if (!res.ok) {
          setInvalidLink(true);
          return;
        }
        setRegistration(await res.json());
      });
  }, [token]);

  async function handleResend() {
    setResending(true);
    const res = await fetch(`/api/edit-registration/${token}/resend`, { method: "POST" });
    setResending(false);
    if (res.ok) {
      setResent(true);
    }
  }

  async function handleSubmit(formData: FormData) {
    setError("");

    const photoFile = formData.get("photo") as File | null;
    const idDocumentFile = formData.get("idDocument") as File | null;

    const body: Record<string, string | null> = {
      lastName: formData.get("lastName") as string,
      firstName: formData.get("firstName") as string,
      email: formData.get("email") as string,
      structure: formData.get("structure") as string,
      teamId: formData.get("teamId") as string,
      idDocumentType: formData.get("idDocumentType") as string,
      idDocumentNumber: formData.get("idDocumentNumber") as string,
      photo: registration!.photo,
      idDocument: registration!.idDocument,
    };

    // Upload new photo if provided
    if (photoFile && photoFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", photoFile);
      uploadData.append("type", "photo");
      uploadData.append("registrationId", registration!.id);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
      if (uploadRes.ok) {
        const { path } = await uploadRes.json();
        body.photo = path;
      }
    }

    // Upload new idDocument if provided
    if (idDocumentFile && idDocumentFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", idDocumentFile);
      uploadData.append("type", "idDocument");
      uploadData.append("registrationId", registration!.id);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
      if (uploadRes.ok) {
        const { path } = await uploadRes.json();
        body.idDocument = path;
      }
    }

    const res = await fetch(`/api/edit-registration/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erreur lors de la modification");
      return;
    }

    router.push("/register/success");
  }

  if (invalidLink) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Lien invalide</h1>
          <p className="text-gray-600">Ce lien de modification est invalide ou l&apos;inscription a déjà été resoumise.</p>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Lien expiré</h1>
          <p className="text-gray-600 mb-6">
            Ce lien de modification a expiré. Vous pouvez demander un nouveau lien par email.
          </p>
          {resent ? (
            <p className="text-green-600 text-sm">Un nouveau lien vous a été envoyé par email.</p>
          ) : (
            <Button onClick={handleResend} disabled={resending}>
              {resending ? "Envoi en cours..." : "Renvoyer le lien"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="w-full max-w-lg bg-white rounded-lg shadow p-8">
        <h1 className="text-xl font-bold text-center mb-2">Modifier mon inscription</h1>
        {registration.rejectionReason ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-amber-700 font-medium mb-1">Votre inscription a été rejetée</p>
            <p className="text-sm text-amber-600">Motif : {registration.rejectionReason}</p>
            {registration.rejectionDetails && (
              <p className="text-sm text-amber-600">{registration.rejectionDetails}</p>
            )}
            <p className="text-sm text-amber-600 mt-2">Veuillez corriger les informations ci-dessous et resoumettre votre inscription.</p>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-blue-700 font-medium mb-1">Modifier mon inscription</p>
            <p className="text-sm text-blue-600">Modifiez les informations ci-dessous et resoumettez votre inscription. Elle sera de nouveau soumise à validation.</p>
          </div>
        )}
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <RegistrationForm
          onSubmit={handleSubmit}
          submitLabel="Resoumettre mon inscription"
          defaultValues={{
            lastName: registration.lastName,
            firstName: registration.firstName,
            email: registration.email,
            structure: registration.structure,
            teamId: registration.teamId,
            idDocumentType: registration.idDocumentType,
            idDocumentNumber: registration.idDocumentNumber,
          }}
        />
      </div>
    </div>
  );
}
