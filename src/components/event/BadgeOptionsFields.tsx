"use client";

import { useState } from "react";
import type { VariableKind } from "@tigamadou/pdf-engine";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Dropzone, FileBox } from "@/components/ui/FileBox";
import { linesToInstructions } from "@/lib/security-instructions";
import type { OptionValue } from "@/lib/badge-templates/template-options";

export type BadgeOption = { name: string; kind: VariableKind; label: string; sample?: unknown };

type Props = {
  options: BadgeOption[];
  values: Record<string, OptionValue | null>;
  onChange: (name: string, value: OptionValue | null) => void;
  onUpload: (file: File) => Promise<string | null>;
};

const TEXTAREA_CLASS =
  "block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy";

// Brouillon local : re-deriver la zone de texte depuis la liste nettoyee effacerait
// la ligne vide qu'on vient d'ouvrir avec Entree.
function ListField({
  option,
  value,
  onChange,
}: {
  option: BadgeOption;
  value: OptionValue | null | undefined;
  onChange: (value: OptionValue | null) => void;
}) {
  const [draft, setDraft] = useState(Array.isArray(value) ? value.join("\n") : "");
  return (
    <textarea
      id={`option-${option.name}`}
      value={draft}
      rows={4}
      placeholder="Une ligne par élément"
      className={TEXTAREA_CLASS}
      onChange={(e) => {
        setDraft(e.target.value);
        const items = linesToInstructions(e.target.value);
        onChange(items.length > 0 ? items : null);
      }}
    />
  );
}

function OptionField({
  option,
  value,
  onChange,
  onUpload,
}: {
  option: BadgeOption;
  value: OptionValue | null | undefined;
  onChange: (value: OptionValue | null) => void;
  onUpload: Props["onUpload"];
}) {
  const id = `option-${option.name}`;
  switch (option.kind) {
    case "boolean":
      return (
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-navy focus:ring-navy"
        />
      );
    case "text":
      return (
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        />
      );
    case "color":
      return (
        <input
          id={id}
          type="color"
          value={typeof value === "string" ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return (
        <Input
          id={id}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        />
      );
    case "list":
      return <ListField option={option} value={value} onChange={onChange} />;
    case "image":
      return typeof value === "string" && value !== "" ? (
        <FileBox
          icon="file"
          thumbUrl={`/api/files/${value}`}
          title={option.label}
          subtitle={value}
          action={
            <Button type="button" variant="secondary" onClick={() => onChange(null)}>
              Retirer
            </Button>
          }
        />
      ) : (
        <Dropzone
          accept="image/jpeg,image/png,image/webp"
          title="Déposer une image ou cliquer"
          subtitle="JPEG, PNG ou WebP — 5 Mo max"
          onFiles={async (files) => {
            const file = files[0];
            if (!file) return;
            const key = await onUpload(file);
            if (key !== null) onChange(key);
          }}
        />
      );
  }
}

function isUnset(value: OptionValue | null | undefined): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function BadgeOptionsFields({ options, values, onChange, onUpload }: Props) {
  if (options.length === 0) return null;
  return (
    <Card>
      <CardHead
        title="Options du badge"
        subtitle="Réglages propres au modèle de badge de cet événement. Enregistrés avec les informations."
      />
      <CardBody>
        <div className="space-y-4">
          {options.map((option) => {
            const value = values[option.name];
            return (
              <div key={option.name} className="space-y-1">
                <label htmlFor={`option-${option.name}`} className="block text-sm font-medium text-slate-700">
                  {option.label}
                  {option.kind !== "boolean" && isUnset(value) && (
                    <span className="ml-2 text-xs text-warn">À renseigner</span>
                  )}
                </label>
                <OptionField
                  option={option}
                  value={value}
                  onChange={(next) => onChange(option.name, next)}
                  onUpload={onUpload}
                />
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
