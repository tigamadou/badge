"use client";

// Vitrine vivante du design system v2-16 (reference de developpement, dev-only).
// Reproduit template/styleguide.html : un exemple de chaque composant transverse.
import { useState } from "react";
import { Icon, ICON_NAMES } from "@/components/ui/Icon";
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
        <RoleBadge tone="slate">AUDITOR</RoleBadge>
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
