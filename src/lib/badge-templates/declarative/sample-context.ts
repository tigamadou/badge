import type { TemplateContext } from "../types";

// Contexte de demonstration utilise par le rendu d'epreuve et la generation d'apercu.
// CONSTANT par construction : ni date du jour, ni aleatoire, pour que deux
// installations du meme paquet produisent exactement le meme apercu.
export const SAMPLE_CONTEXT: TemplateContext = {
  participant: {
    firstName: "Awa",
    lastName: "Diallo",
    structure: "Organisation de démonstration",
    photoDataUrl: "",
  },
  category: { name: "Visiteur", color: "#4f46e5", neutralBadge: false, anonymous: false },
  event: {
    title: "Événement de démonstration",
    date: new Date("2027-12-15T00:00:00Z"),
    location: "Niamey",
    logoDataUrl: null,
  },
  badge: {
    id: "DEMO-0001",
    verifyUrl: "https://badge.local/verify/DEMO-0001",
    qrCodeDataUrl: "",
  },
};
