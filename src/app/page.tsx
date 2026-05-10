"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReCAPTCHA from "react-google-recaptcha";
import { RegistrationForm } from "@/components/admin/RegistrationForm";
import { formatEventDate } from "@/lib/format-date";

interface EventInfo {
  title: string;
  location: string;
  date: string;
  logo: string | null;
}

export default function Home() {
  const router = useRouter();
  const captchaRef = useRef<ReCAPTCHA>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [event, setEvent] = useState<EventInfo | null>(null);

  useEffect(() => {
    fetch("/api/event")
      .then((r) => r.json())
      .then(setEvent);
  }, []);

  async function handleSubmit(formData: FormData) {
    if (!captchaToken) {
      setError("Veuillez compléter le CAPTCHA");
      return;
    }
    setError("");

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
      captchaToken,
    };

    const res = await fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erreur lors de l'inscription");
      captchaRef.current?.reset();
      setCaptchaToken(null);
      return;
    }

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

    router.push("/register/success");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="w-full max-w-lg bg-white rounded-lg shadow p-8">
        {event?.logo && (
          <div className="flex justify-center mb-4">
            <img
              src={`/api/files/${event.logo}`}
              alt="Logo de l'événement"
              className="h-24 w-auto object-contain"
            />
          </div>
        )}
        <h1 className="text-xl font-bold text-center mb-2">Inscription</h1>
        {event && (
          <p className="text-sm text-gray-500 text-center mb-6">
            {event.title} — {event.location}, {formatEventDate(event.date)}
          </p>
        )}
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <RegistrationForm
          onSubmit={handleSubmit}
          submitLabel="S'inscrire"
          captchaWidget={
            <div className="mb-4">
              <ReCAPTCHA
                ref={captchaRef}
                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
                onChange={(token) => setCaptchaToken(token)}
              />
            </div>
          }
        />
      </div>
    </div>
  );
}
