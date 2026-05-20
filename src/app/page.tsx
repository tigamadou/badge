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
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [eventLoaded, setEventLoaded] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    fetch("/api/event")
      .then((r) => r.json())
      .then((eventData) => {
        setEvent(eventData);
        if (eventData) {
          setRegistrationOpen(eventData.registrationOpen ?? true);
        }
        setEventLoaded(true);
      });

    fetch("/api/settings")
      .then((r) => r.json())
      .then((settings) => {
        if (settings) {
          setRecaptchaEnabled(settings.recaptchaEnabled || false);
          setRecaptchaSiteKey(settings.recaptchaSiteKey || "");
        }
      });
  }, []);

  async function handleSubmit(formData: FormData) {
    if (recaptchaEnabled && !captchaToken) {
      setError("Veuillez compléter le CAPTCHA");
      return;
    }
    setError("");
    setCanResend(false);
    setResent(false);

    const photoFile = formData.get("photo") as File | null;
    const idDocumentFile = formData.get("idDocument") as File | null;

    // Upload des fichiers d'abord avec un ID temporaire
    const tempId = crypto.randomUUID();
    const body: Record<string, string> = {
      lastName: formData.get("lastName") as string,
      firstName: formData.get("firstName") as string,
      email: formData.get("email") as string,
      structure: formData.get("structure") as string,
      teamId: formData.get("teamId") as string,
      idDocumentType: formData.get("idDocumentType") as string,
      idDocumentNumber: formData.get("idDocumentNumber") as string,
    };

    if (captchaToken) {
      body.captchaToken = captchaToken;
    }

    if (photoFile && photoFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", photoFile);
      uploadData.append("type", "photo");
      uploadData.append("registrationId", tempId);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
      if (uploadRes.ok) {
        const { path } = await uploadRes.json();
        body.photo = path;
      }
    }

    if (idDocumentFile && idDocumentFile.size > 0) {
      const uploadData = new FormData();
      uploadData.append("file", idDocumentFile);
      uploadData.append("type", "idDocument");
      uploadData.append("registrationId", tempId);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
      if (uploadRes.ok) {
        const { path } = await uploadRes.json();
        body.idDocument = path;
      }
    }

    const res = await fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erreur lors de l'inscription");
      if (data.canResend) {
        setCanResend(true);
        setResendEmail(data.email);
      } else {
        setCanResend(false);
      }
      captchaRef.current?.reset();
      setCaptchaToken(null);
      return;
    }

    router.push("/register/success");
  }

  async function handleResendEditLink() {
    setResending(true);
    await fetch("/api/registrations/resend-edit-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resendEmail }),
    });
    setResending(false);
    setResent(true);
  }

  if (!eventLoaded) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <img
            src="/icon.png"
            alt="Logo"
            className="h-24 w-auto object-contain animate-pulse"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12">
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
        {!registrationOpen ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Inscriptions fermées</h2>
            <p className="text-sm text-slate-500">
              Les inscriptions ne sont plus ouvertes pour le moment.<br />
              Merci de votre compréhension.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4">
                <p className="text-sm text-red-500">{error}</p>
                {canResend && !resent && (
                  <button
                    type="button"
                    onClick={handleResendEditLink}
                    disabled={resending}
                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 underline"
                  >
                    {resending ? "Envoi en cours..." : "Recevoir un lien de modification"}
                  </button>
                )}
                {resent && (
                  <p className="mt-2 text-sm text-green-600">Un lien vous a été envoyé par email.</p>
                )}
              </div>
            )}
            <RegistrationForm
              onSubmit={handleSubmit}
              submitLabel="S'inscrire"
              excludeAnonymousTeams={true}
              captchaWidget={
                recaptchaEnabled && recaptchaSiteKey ? (
                  <div className="mb-4">
                    <ReCAPTCHA
                      ref={captchaRef}
                      sitekey={recaptchaSiteKey}
                      onChange={(token) => setCaptchaToken(token)}
                    />
                  </div>
                ) : undefined
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
