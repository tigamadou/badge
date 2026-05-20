"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={
      <div className="bg-slate-50 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-6 text-center">
          <p className="text-slate-500">Chargement...</p>
        </div>
      </div>
    }>
      <SetupPasswordContent />
    </Suspense>
  );
}

function SetupPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-6 text-center">
          <p className="text-rose-600">Lien invalide. Aucun token fourni.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-6">
        <h1 className="text-xl font-semibold text-slate-900 mb-6 text-center">
          Configurer votre mot de passe
        </h1>

        {success ? (
          <div className="text-center">
            <p className="text-emerald-600 mb-4">
              Votre mot de passe a été configuré avec succes.
            </p>
            <Link
              href="/login"
              className="inline-block bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium"
            >
              Se connecter
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && <p className="text-rose-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Configuration..." : "Configurer le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
