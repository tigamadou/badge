"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

// reCAPTCHA v3 : le script de Google fournit `grecaptcha`, qui renvoie un jeton par action.
// Le serveur (src/lib/recaptcha.ts) verifie ce jeton et son score.
type Grecaptcha = {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

type RecaptchaConfig = { enabled: boolean; siteKey: string };

const RecaptchaContext = createContext<RecaptchaConfig>({ enabled: false, siteKey: "" });

// Un seul chargement du script par cle, partage entre les formulaires de la page.
const scriptLoads = new Map<string, Promise<void>>();

function loadScript(siteKey: string): Promise<void> {
  const cached = scriptLoads.get(siteKey);
  if (cached) return cached;

  const loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error("Chargement de reCAPTCHA impossible."));
    };
    document.head.appendChild(script);
  });
  // Un echec n'est pas memorise : le prochain envoi retente le chargement.
  loading.catch(() => scriptLoads.delete(siteKey));
  scriptLoads.set(siteKey, loading);
  return loading;
}

export function RecaptchaProvider({
  enabled,
  siteKey,
  children,
}: RecaptchaConfig & { children: React.ReactNode }) {
  const config = useMemo(() => ({ enabled, siteKey }), [enabled, siteKey]);

  // Charge le script des l'affichage du formulaire : le jeton est demande a l'envoi,
  // et il expire au bout de deux minutes.
  useEffect(() => {
    if (enabled && siteKey) loadScript(siteKey).catch(() => undefined);
  }, [enabled, siteKey]);

  return <RecaptchaContext.Provider value={config}>{children}</RecaptchaContext.Provider>;
}

export function useRecaptcha() {
  const { enabled, siteKey } = useContext(RecaptchaContext);

  // Renvoie le jeton de l'action, ou null si la verification est desactivee ou n'a pas pu
  // demarrer (cle absente, script bloque). L'appelant distingue les deux avec `enabled`.
  const execute = useCallback(
    async (action: string): Promise<string | null> => {
      if (!enabled || !siteKey) return null;
      try {
        await loadScript(siteKey);
        const grecaptcha = window.grecaptcha;
        if (!grecaptcha) return null;
        await new Promise<void>((resolve) => grecaptcha.ready(resolve));
        return await grecaptcha.execute(siteKey, { action });
      } catch {
        return null;
      }
    },
    [enabled, siteKey],
  );

  return { enabled, execute };
}
