"use client";

// Vitrine vivante du design system v2-16 (reference de developpement, dev-only).
// Reproduit template/styleguide.html : un exemple de chaque composant transverse.
import { useState } from "react";
import { Icon, ICON_NAMES } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  SHELL_BANNER,
  SIDEBAR_BRAND,
  SIDEBAR_COUNT,
  SIDEBAR_FOOTER_TEXT,
  SIDEBAR_GROUP,
  SIDEBAR_LINK,
  SIDEBAR_LINK_ACTIVE,
} from "@/components/layout/sidebar-classes";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { QuotaBar, StorageAlert } from "@/components/ui/QuotaBar";
import { MiniChart } from "@/components/ui/MiniChart";
import { Alert, EmptyState, Spinner, ProgressBar, SuccessRing } from "@/components/ui/Feedback";
import { Toolbar, SearchInput, ChipFilter } from "@/components/ui/Toolbar";
import { BatchBar, BatchButton } from "@/components/ui/BatchBar";
import { CatPill, RoleBadge, Tag } from "@/components/ui/Labels";
import { FormSection, Switch, Checkbox } from "@/components/ui/FormControls";
import { RadioCards } from "@/components/ui/RadioCards";
import { FileBox, Dropzone } from "@/components/ui/FileBox";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { PasswordMeter } from "@/components/ui/PasswordMeter";
import { Stepper } from "@/components/ui/Stepper";
import { Tabs, Segmented } from "@/components/ui/Tabs";
import { OrgLogo, PickCard, PickCardDashed } from "@/components/ui/PickCard";
import { VerifyBanner } from "@/components/ui/VerifyBanner";
import { LogType, KeyValue, Diff, Payload } from "@/components/ui/JournalBlocks";
import { MiniBadge } from "@/components/badge/MiniBadge";
import { ScannerFrame, ScanResult } from "@/components/event/ScannerFrame";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      <div className="flex flex-wrap items-start gap-6">{children}</div>
    </section>
  );
}

// Les 13 couleurs du thème (globals.css), avec la classe de fond et la couleur de texte lisible.
const PALETTE: { name: string; bg: string; hex: string; text: string }[] = [
  { name: "navy", bg: "bg-navy", hex: "#081558", text: "text-white" },
  { name: "navy-hover", bg: "bg-navy-hover", hex: "#121F6E", text: "text-white" },
  { name: "gold", bg: "bg-gold", hex: "#F4B942", text: "text-navy" },
  { name: "gold-strong", bg: "bg-gold-strong", hex: "#8A5A00", text: "text-white" },
  { name: "gold-soft", bg: "bg-gold-soft", hex: "#FFF4DC", text: "text-gold-strong" },
  { name: "turquoise", bg: "bg-turquoise", hex: "#16B8A6", text: "text-navy" },
  { name: "turquoise-strong", bg: "bg-turquoise-strong", hex: "#0E7C70", text: "text-white" },
  { name: "turquoise-soft", bg: "bg-turquoise-soft", hex: "#E3F7F4", text: "text-turquoise-strong" },
  { name: "mist", bg: "bg-mist", hex: "#F5F7FC", text: "text-navy" },
  { name: "line", bg: "bg-line", hex: "#EEF1F8", text: "text-navy" },
  { name: "nav-muted", bg: "bg-nav-muted", hex: "#5A6285", text: "text-white" },
  { name: "warn", bg: "bg-warn", hex: "#C2410C", text: "text-white" },
  { name: "warn-soft", bg: "bg-warn-soft", hex: "#FFF1E6", text: "text-warn" },
];

export default function StyleguidePage() {
  const [sw, setSw] = useState(true);
  const [ck, setCk] = useState(false);
  const [cat, setCat] = useState<string | null>("expo");
  const [tab, setTab] = useState("emails");
  const [seg, setSeg] = useState("actif");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-8 text-xl font-semibold text-slate-900">Styleguide — design system v2-16</h1>

      <Section title="Palette">
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {PALETTE.map((c) => (
            <div
              key={c.name}
              className={`rounded-lg border border-slate-200 px-3 py-4 text-xs font-medium ${c.bg} ${c.text}`}
            >
              <div>{c.bg}</div>
              <div className="mt-0.5 font-normal">{c.hex}</div>
            </div>
          ))}
        </div>
        <div className="grid w-full gap-2 text-sm sm:grid-cols-2">
          <p className="rounded-lg bg-navy px-3 py-2 text-white">Blanc sur marine (16,7)</p>
          <p className="rounded-lg bg-turquoise px-3 py-2 text-navy">Marine sur turquoise (6,7)</p>
          <p className="rounded-lg bg-gold px-3 py-2 text-navy">Marine sur or (9,4)</p>
          <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-turquoise-strong">
            Turquoise foncé sur blanc (5,1)
          </p>
          <p className="rounded-lg bg-gold-soft px-3 py-2 text-gold-strong">Or foncé sur or pâle</p>
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-warn">Orange sur orange pâle (4,7)</p>
          <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-nav-muted">
            Gris bleu sur blanc (6,0)
          </p>
        </div>
      </Section>

      <Section title="Boutons">
        {(["primary", "positive", "secondary", "danger", "link"] as const).map((variant) => (
          <div key={variant} className="flex flex-col items-start gap-2">
            <span className="text-xs text-slate-500">{variant}</span>
            <Button variant={variant}>Normal</Button>
            <Button variant={variant} disabled>
              Désactivé
            </Button>
            <Button variant={variant} loading>
              Chargement
            </Button>
          </div>
        ))}
      </Section>

      <Section title="Menu latéral clair">
        <div className="w-56 border-r border-line bg-white p-3">
          <div className={SIDEBAR_BRAND}>Badge</div>
          <div className="flex flex-col gap-1">
            <div className={SIDEBAR_GROUP}>Impression</div>
            <a href="#" className={SIDEBAR_LINK}>
              <Icon name="printer" size={18} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">Planches</span>
            </a>
            <a href="#" aria-current="page" className={SIDEBAR_LINK_ACTIVE}>
              <Icon name="inbox" size={18} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">Commandes</span>
              <span className={SIDEBAR_COUNT}>3</span>
            </a>
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <div className={SIDEBAR_FOOTER_TEXT}>awa@exemple.org</div>
          </div>
        </div>
        <div className={`w-72 rounded-lg ${SHELL_BANNER}`}>Mode staff — actions auditées</div>
      </Section>

      <Section title="Statistiques">
        <div className="w-full">
          <StatGrid cols={4}>
            <StatCard label="Organisations" value="24" icon="building-2" sub="ce mois" delta={{ dir: "up", text: "+2" }} />
            <StatCard label="Evenements" value="38" icon="calendar" sub="11 actifs" />
            <StatCard label="Inscriptions" value="12 480" icon="user-check" delta={{ dir: "up", text: "+840" }} sub="30 j" />
            <StatCard label="Rejetees" value="12" icon="user-check" delta={{ dir: "down", text: "-3" }} />
          </StatGrid>
        </div>
      </Section>

      <Section title="Cartes, timeline, quota, chart">
        <Card className="w-80">
          <CardHead title="Top organisations" subtitle="Par inscriptions" action={<Tag icon="external-link">voir</Tag>} />
          <CardBody>
            <QuotaBar label="Universite Forum" valueText="2 105" pct={100} />
            <QuotaBar label="Salon Tech" valueText="1 248" pct={59} />
          </CardBody>
        </Card>
        <Card className="w-80">
          <CardHead title="Activite recente" />
          <CardBody>
            <Timeline>
              <TimelineItem tone="ok" title="Organisation creee" meta="Marie Dubois - il y a 2 h" />
              <TimelineItem title="Quota releve" meta="Systeme - il y a 5 h" />
              <TimelineItem tone="warn" title="Test SMTP echoue" meta="Systeme - hier" />
            </Timeline>
          </CardBody>
        </Card>
        <div className="w-80">
          <MiniChart values={[3, 6, 4, 8, 5, 9, 7, 10, 6, 8, 12, 9]} ariaLabel="Inscriptions 30 jours" />
        </div>
      </Section>

      <Section title="Alertes & etats">
        <div className="w-full space-y-3">
          <StorageAlert pct={82}>Quota de stockage bientot atteint (82%).</StorageAlert>
          <Alert tone="info">Message d&apos;information.</Alert>
          <Alert tone="warn">Message d&apos;avertissement.</Alert>
          <Alert tone="err">Identifiants incorrects.</Alert>
          <Alert tone="success">Inscription approuvee.</Alert>
        </div>
        <Card className="w-80">
          <EmptyState icon="inbox" title="Aucune inscription" description="Les inscriptions apparaitront ici." />
        </Card>
        <div className="flex items-center gap-6">
          <Spinner />
          <div className="w-40">
            <ProgressBar pct={66} />
          </div>
          <SuccessRing>
            <Icon name="check" size={30} />
          </SuccessRing>
        </div>
      </Section>

      <Section title="Listes">
        <div className="w-full">
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="Rechercher" />
            <ChipFilter
              label="Statut"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Tous" },
                { value: "pending", label: "En attente" },
                { value: "approved", label: "Approuvees" },
              ]}
            />
          </Toolbar>
          <BatchBar count={3}>
            <BatchButton icon="check" onClick={() => {}}>
              Approuver
            </BatchButton>
            <BatchButton icon="printer" onClick={() => {}}>
              Imprimer
            </BatchButton>
          </BatchBar>
        </div>
      </Section>

      <Section title="Etiquettes">
        <CatPill color="#16a34a" label="Exposant" count={128} />
        <CatPill color="#dc2626" label="Presse" count={12} />
        <RoleBadge tone="navy">SUPER_ADMIN</RoleBadge>
        <RoleBadge tone="green">OWNER</RoleBadge>
        <RoleBadge tone="amber">MANAGER</RoleBadge>
        <RoleBadge tone="warn">SUPERVISION</RoleBadge>
        <RoleBadge tone="slate">AUDITOR</RoleBadge>
        <StatusBadge status="PENDING" />
        <StatusBadge status="APPROVED" />
        <StatusBadge status="REJECTED" />
        <Tag icon="clock">en attente</Tag>
      </Section>

      <Section title="Formulaires">
        <Card className="w-full">
          <CardBody>
            <FormSection title="Preferences" description="Exemple de section de formulaire.">
              <div className="flex flex-col gap-3">
                <Switch checked={sw} onChange={setSw} label="Inscriptions ouvertes" />
                <Checkbox checked={ck} onChange={setCk} label="J'accepte les conditions" />
                <PasswordMeter score={3} />
              </div>
            </FormSection>
            <FormSection title="Categorie">
              <RadioCards
                name="categorie"
                value={cat}
                onChange={setCat}
                options={[
                  { value: "expo", title: "Exposant", description: "Acces salon", color: "#16a34a" },
                  { value: "press", title: "Presse", description: "Zone media", color: "#dc2626" },
                  { value: "vip", title: "VIP", description: "Tous acces", color: "#7c3aed" },
                ]}
              />
            </FormSection>
            <FormSection title="Depot de fichier">
              <div className="grid gap-3 sm:grid-cols-2">
                <Dropzone onFiles={() => {}} title="Deposez un fichier" subtitle="JPEG, PNG, PDF - max 5 Mo" />
                <FileBox icon="file" title="carte-identite.pdf" subtitle="240 Ko" action={<Tag icon="trash-2">retirer</Tag>} />
              </div>
            </FormSection>
            <FormSection title="Apercu de document (DocumentPreview)">
              <div className="grid gap-3 sm:grid-cols-2">
                <DocumentPreview storageKey="profile/demo/photos/demo.png" label="Photo (image)" />
                <DocumentPreview storageKey="profile/demo/documents/demo.pdf" label="Piece (PDF)" />
                <DocumentPreview storageKey={null} label="Document absent" />
                <DocumentPreview storageKey="profile/demo/documents/demo.pdf" label="Non consultable" readable={false} />
              </div>
            </FormSection>
          </CardBody>
        </Card>
      </Section>

      <Section title="Navigation intra-page">
        <div className="w-full">
          <Stepper steps={["Informations", "Categories", "Recapitulatif"]} current={1} />
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "emails", label: "E-mails" },
              { value: "docs", label: "Documents" },
            ]}
          />
          <Segmented
            value={seg}
            onChange={setSeg}
            options={[
              { value: "actif", label: "Actifs" },
              { value: "archive", label: "Archives" },
            ]}
          />
        </div>
      </Section>

      <Section title="Selecteur d'organisation">
        <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          <PickCard href="#" logo={<OrgLogo name="Universite Forum" />} title="Universite Forum" meta="5 evenements" />
          <PickCard href="#" logo={<OrgLogo name="Salon Tech" />} title="Salon Tech" meta="3 evenements" />
          <PickCardDashed href="#" icon="shield" label="Toutes les organisations (mode staff)" />
        </div>
      </Section>

      <Section title="Badge & scanner & verification">
        <div className="grid grid-cols-3 gap-2">
          <MiniBadge name="A. Dupont" category="Visiteur" categoryColor="#2563eb" state="done" />
          <MiniBadge name="B. Martin" category="Presse" categoryColor="#dc2626" state="generating" />
          <MiniBadge name="C. Bernard" category="VIP" categoryColor="#7c3aed" state="pending" />
        </div>
        <div className="w-72 space-y-4">
          <ScannerFrame />
          <ScanResult valid title="Acces autorise" />
        </div>
        <div className="w-72">
          <VerifyBanner valid title="Badge valide" />
        </div>
      </Section>

      <Section title="Journal">
        <div className="w-full space-y-4">
          <div className="flex flex-wrap gap-2">
            <LogType kind="creation">Creation</LogType>
            <LogType kind="modification">Modification</LogType>
            <LogType kind="suppression">Suppression</LogType>
            <LogType kind="systeme">Systeme</LogType>
            <LogType kind="connexion">Connexion</LogType>
            <LogType kind="acces">Acces</LogType>
          </div>
          <KeyValue
            items={[
              { label: "Auteur", value: "Marie Dubois" },
              { label: "Date", value: "06/07/2026 14:20" },
            ]}
          />
          <Diff oldValue="Presse" newValue="Presse (anonyme)" />
          <Payload json={'{\n  "category": "Presse",\n  "anonymous": true\n}'} />
        </div>
      </Section>

      <Section title="Icones">
        <div className="flex flex-wrap gap-3 text-slate-600">
          {ICON_NAMES.map((n) => (
            <span key={n} title={n} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200">
              <Icon name={n} size={18} />
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}
