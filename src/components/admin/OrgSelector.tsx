"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type Org = { id: string; name: string; slug: string };

export function OrgSelector({
  currentOrgId,
  orgs,
  isStaff,
}: {
  currentOrgId: string;
  orgs: Org[];
  isStaff: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (currentOrgId) {
      localStorage.setItem("badge.lastOrgId", currentOrgId);
    }
  }, [currentOrgId]);

  const current = orgs.find((o) => o.id === currentOrgId);

  function switchTo(orgId: string) {
    // On garde la section courante (events, members…) mais pas les identifiants
    // qui appartiennent a l'ancienne organisation.
    const section = pathname.match(/^\/org\/[^/]+\/([^/]+)/)?.[1];
    router.push(section ? `/org/${orgId}/${section}` : `/org/${orgId}`);
    setOpen(false);
  }

  if (orgs.length <= 1 && !isStaff) {
    return <span className="text-sm font-medium">{current?.name}</span>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-mist"
      >
        <span>{current?.name ?? "Sélectionner"}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-md border bg-white shadow-lg z-10">
          <ul className="py-1">
            {orgs.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => switchTo(o.id)}
                  className={`block w-full px-4 py-2 text-left text-sm hover:bg-mist ${
                    o.id === currentOrgId ? "font-semibold" : ""
                  }`}
                >
                  {o.name}
                </button>
              </li>
            ))}
            {isStaff && (
              <li className="border-t">
                <button
                  onClick={() => router.push("/platform")}
                  className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-mist"
                >
                  Toutes les organisations (mode staff)
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
