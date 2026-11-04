"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { ThreadEntryDTO } from "@/lib/print-requests/thread";

// Saisie d'un message de l'organisateur (jamais de note interne). Tous les textes sont rendus
// par React : jamais de HTML injecté.
export function OrganizerComposer({
  postUrl,
  uploadUrl,
  onPosted,
}: {
  postUrl: string;
  uploadUrl: string;
  onPosted: (entry: ThreadEntryDTO) => void;
}) {
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<{ key: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(uploadUrl, { method: "POST", body: form });
      if (!res.ok) throw res;
      const data = (await res.json()) as { storageKey: string; originalName?: string };
      setAttachment({ key: data.storageKey, name: data.originalName ?? file.name });
    } finally {
      setUploading(false);
    }
  }
  const { run: runUpload } = useAsyncAction(upload, { error: "Le fichier n'a pas pu être envoyé." });

  const { run: send, pending } = useAsyncAction(
    async () => {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, ...(attachment ? { attachmentKey: attachment.key } : {}) }),
      });
      if (!res.ok) throw res;
      return ((await res.json()) as { entry: ThreadEntryDTO }).entry;
    },
    {
      error: "Le message n'a pas pu être envoyé.",
      onSuccess: (entry) => {
        setBody("");
        setAttachment(null);
        onPosted(entry);
      },
    },
  );

  return (
    <form
      className="flex-none space-y-2 border-t border-slate-100 bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim() || attachment) void send();
      }}
    >
      <label htmlFor="organizer-thread-body" className="sr-only">
        Votre message
      </label>
      <textarea
        id="organizer-thread-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        rows={2}
        placeholder="Écrire un message à l'équipe Badge…"
        className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      {attachment ? (
        <div className="flex items-center gap-2 text-[13px] text-slate-600">
          <Icon name="file" size={14} />
          <span className="break-all">{attachment.name}</span>
          <button type="button" className="text-rose-600" onClick={() => setAttachment(null)}>
            Retirer
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          aria-label="Fichier à joindre"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void runUpload(file);
          }}
        />
        <Button type="button" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
          Joindre un fichier
        </Button>
        <Button type="submit" loading={pending} disabled={!body.trim() && !attachment}>
          Envoyer
        </Button>
      </div>
    </form>
  );
}
