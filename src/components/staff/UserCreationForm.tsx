"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrgLite = { id: string; name: string };

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

export function UserCreationForm({
  orgs,
  canCreateStaff,
  canCreateTopStaff,
}: {
  orgs: OrgLite[];
  canCreateStaff: boolean;
  canCreateTopStaff: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    name: "",
    type: "client" as "client" | "staff",
    staffRole: "STAFF_OBSERVER" as StaffRoleStr,
    orgId: "",
    orgRole: "OWNER" as "OWNER" | "MANAGER" | "AUDITOR",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const payload: Record<string, unknown> = {
      email: form.email.trim(),
      name: form.name.trim(),
      type: form.type,
    };
    if (form.type === "staff") payload.staffRole = form.staffRole;
    if (form.type === "client" && form.orgId) {
      payload.orgId = form.orgId;
      payload.orgRole = form.orgRole;
    }

    const res = await fetch("/api/staff/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      const json = await res.json();
      router.push(`/staff/users/${json.user.id}`);
    } else if (res.status === 409) {
      setMsg("Email deja utilise.");
    } else {
      const json = await res.json().catch(() => ({}));
      setMsg(json.error ?? "Erreur a la creation.");
    }
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-3 bg-white border rounded p-4">
      {msg && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {msg}
        </div>
      )}

      <Field
        label="Email"
        type="email"
        value={form.email}
        onChange={(v) => setForm((f) => ({ ...f, email: v }))}
        required
      />
      <Field
        label="Nom complet"
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
        required
      />

      <fieldset className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={form.type === "client"}
            onChange={() => setForm((f) => ({ ...f, type: "client" }))}
          />
          Client
        </label>
        {canCreateStaff && (
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={form.type === "staff"}
              onChange={() => setForm((f) => ({ ...f, type: "staff" }))}
            />
            Staff applicatif
          </label>
        )}
      </fieldset>

      {form.type === "staff" && (
        <label className="block">
          <span className="text-sm text-slate-600">Role staff</span>
          <select
            value={form.staffRole}
            onChange={(e) =>
              setForm((f) => ({ ...f, staffRole: e.target.value as StaffRoleStr }))
            }
            className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
          >
            <option value="STAFF_OBSERVER">STAFF_OBSERVER</option>
            <option value="STAFF_SUPPORT">STAFF_SUPPORT</option>
            {canCreateTopStaff && <option value="STAFF_ADMIN">STAFF_ADMIN</option>}
            {canCreateTopStaff && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
          </select>
        </label>
      )}

      {form.type === "client" && (
        <>
          <label className="block">
            <span className="text-sm text-slate-600">
              Lier a une organisation (optionnel)
            </span>
            <select
              value={form.orgId}
              onChange={(e) => setForm((f) => ({ ...f, orgId: e.target.value }))}
              className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
            >
              <option value="">Aucune</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          {form.orgId && (
            <label className="block">
              <span className="text-sm text-slate-600">Role dans l&apos;organisation</span>
              <select
                value={form.orgRole}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    orgRole: e.target.value as typeof form.orgRole,
                  }))
                }
                className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
              >
                <option value="OWNER">OWNER</option>
                <option value="MANAGER">MANAGER</option>
                <option value="AUDITOR">AUDITOR</option>
              </select>
            </label>
          )}
        </>
      )}

      <p className="text-xs text-slate-500">
        L&apos;utilisateur recevra un email avec un lien setup-password valable 24h.
      </p>

      <button
        type="submit"
        disabled={busy || !form.email.trim() || !form.name.trim()}
        className="rounded bg-green-600 text-white px-3 py-1.5 text-sm disabled:bg-slate-300"
      >
        {busy ? "Creation..." : "Creer l'utilisateur"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
      />
    </label>
  );
}
