# Badge Printed Notification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to mark badges as printed (individually or in batch) and automatically notify registrants with contact info for badge pickup.

**Architecture:** Add `badgePrinted`/`badgePrintedAt` fields to Registration and `contactEmail`/`contactPhone` to Event. Extend PATCH endpoint for individual marking, add POST batch endpoint. Add email notification function. Update admin UI with print button, checkboxes, and batch action.

**Tech Stack:** Next.js (App Router), Prisma (MySQL), Nodemailer, React, Tailwind CSS, Vitest

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma:40-54` (Registration model)
- Modify: `prisma/schema.prisma:25-31` (Event model)

- [ ] **Step 1: Add fields to Registration model**

In `prisma/schema.prisma`, update the Registration model to add `badgePrinted` and `badgePrintedAt` after the `status` field:

```prisma
model Registration {
  id               String             @id
  email            String
  lastName         String
  firstName        String
  structure        String
  photo            String?
  idDocumentType   String
  idDocumentNumber String
  idDocument       String?
  status           RegistrationStatus @default(PENDING)
  badgePrinted     Boolean            @default(false)
  badgePrintedAt   DateTime?
  teamId           String
  team             Team               @relation(fields: [teamId], references: [id])
  createdAt        DateTime           @default(now())
}
```

- [ ] **Step 2: Add fields to Event model**

In `prisma/schema.prisma`, update the Event model to add `contactEmail` and `contactPhone`:

```prisma
model Event {
  id           String  @id @default(cuid())
  title        String
  location     String
  date         String
  logo         String?
  contactEmail String?
  contactPhone String?
}
```

- [ ] **Step 3: Generate migration and apply**

Run:
```bash
npx prisma migrate dev --name add-badge-printed-and-contact-fields
```

Expected: Migration created and applied successfully, Prisma client regenerated.

- [ ] **Step 4: Verify schema**

Run:
```bash
npx prisma db push --dry-run
```

Expected: "All fields are already in sync"

---

### Task 2: Add `sendBadgePrintedNotification` Email Function

**Files:**
- Modify: `src/lib/mail.ts:67` (add new function at end)
- Modify: `src/lib/__tests__/mail.test.ts` (add test)

- [ ] **Step 1: Write the failing test**

Add this test at the end of the `describe("mail", ...)` block in `src/lib/__tests__/mail.test.ts`:

```typescript
it("sendBadgePrintedNotification sends email with contact info", async () => {
  const { sendBadgePrintedNotification } = await import("../mail");
  await expect(
    sendBadgePrintedNotification(
      "user@test.com",
      "Jean Dupont",
      "abc123",
      "contact@event.com",
      "+229 97 00 00 00"
    )
  ).resolves.not.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/mail.test.ts`

Expected: FAIL — `sendBadgePrintedNotification` is not exported from `../mail`

- [ ] **Step 3: Implement `sendBadgePrintedNotification`**

Add this function at the end of `src/lib/mail.ts`:

```typescript
export async function sendBadgePrintedNotification(
  to: string,
  fullName: string,
  registrationId: string,
  contactEmail: string,
  contactPhone: string
): Promise<void> {
  const transporter = getTransporter();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  await transporter.sendMail({
    from: FROM,
    to,
    subject: "Badge prêt — Cérémonie d'investiture",
    html: `
      <h2>Votre badge est prêt</h2>
      <p>Bonjour ${fullName},</p>
      <p>Votre badge a été imprimé et est prêt à être retiré.</p>
      <p>Pour le retrait, veuillez vous présenter <strong>muni(e) de votre pièce d'identité</strong> (celle fournie lors de votre inscription).</p>
      <p>Pour toute question concernant le retrait, vous pouvez nous contacter :</p>
      <ul>
        <li>Email : <a href="mailto:${contactEmail}">${contactEmail}</a></li>
        <li>Téléphone : ${contactPhone}</li>
      </ul>
      <p>Vous pouvez consulter votre badge en ligne :</p>
      <p><a href="${baseUrl}/badge/${registrationId}">Voir mon badge</a></p>
    `,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/mail.test.ts`

Expected: All 4 tests PASS

---

### Task 3: Update PATCH `/api/registrations/[id]` for Badge Printing

**Files:**
- Modify: `src/app/api/registrations/[id]/route.ts:26-56` (PATCH handler)

- [ ] **Step 1: Update PATCH handler to handle `badgePrinted`**

Replace the entire PATCH function in `src/app/api/registrations/[id]/route.ts` with:

```typescript
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  // If marking as printed, add timestamp
  if (data.badgePrinted === true) {
    data.badgePrintedAt = new Date();
  }

  const registration = await prisma.registration.update({
    where: { id },
    data,
    include: { team: true },
  });

  // Send status notification if status changed
  if (data.status && (data.status === "APPROVED" || data.status === "REJECTED")) {
    try {
      await sendStatusNotification(
        registration.email,
        `${registration.firstName} ${registration.lastName}`,
        data.status,
        registration.id
      );
    } catch (e) {
      console.error("Failed to send status notification:", e);
    }
  }

  // Send badge printed notification
  if (data.badgePrinted === true) {
    try {
      const event = await prisma.event.findFirst();
      if (event?.contactEmail && event?.contactPhone) {
        await sendBadgePrintedNotification(
          registration.email,
          `${registration.firstName} ${registration.lastName}`,
          registration.id,
          event.contactEmail,
          event.contactPhone
        );
      }
    } catch (e) {
      console.error("Failed to send badge printed notification:", e);
    }
  }

  return NextResponse.json(registration);
}
```

- [ ] **Step 2: Add import for `sendBadgePrintedNotification`**

Update the import line in `src/app/api/registrations/[id]/route.ts`:

```typescript
import { sendStatusNotification, sendBadgePrintedNotification } from "@/lib/mail";
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx next build` or `npx tsc --noEmit`

Expected: No type errors

---

### Task 4: Create Batch Print Endpoint

**Files:**
- Create: `src/app/api/registrations/print/route.ts`

- [ ] **Step 1: Create the batch endpoint**

Create `src/app/api/registrations/print/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBadgePrintedNotification } from "@/lib/mail";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { ids } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "IDs requis" }, { status: 400 });
  }

  const event = await prisma.event.findFirst();
  const hasContact = event?.contactEmail && event?.contactPhone;

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const id of ids) {
    try {
      const registration = await prisma.registration.findUnique({ where: { id } });

      if (!registration || registration.status !== "APPROVED" || registration.badgePrinted) {
        skipped++;
        continue;
      }

      await prisma.registration.update({
        where: { id },
        data: { badgePrinted: true, badgePrintedAt: new Date() },
      });

      if (hasContact) {
        try {
          await sendBadgePrintedNotification(
            registration.email,
            `${registration.firstName} ${registration.lastName}`,
            registration.id,
            event!.contactEmail!,
            event!.contactPhone!
          );
        } catch (e) {
          console.error(`Failed to send notification for ${id}:`, e);
        }
      }

      success++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ success, skipped, errors });
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`

Expected: No type errors

---

### Task 5: Update Event Form with Contact Fields

**Files:**
- Modify: `src/components/admin/EventForm.tsx`
- Modify: `src/app/admin/event/page.tsx`
- Modify: `src/app/api/event/route.ts`

- [ ] **Step 1: Update EventData interface and EventForm component**

In `src/components/admin/EventForm.tsx`, update the `EventData` interface:

```typescript
interface EventData {
  title: string;
  location: string;
  date: string;
  logo: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}
```

Add state for the new fields inside the `EventForm` component, after the existing `useState` calls:

```typescript
const [contactEmail, setContactEmail] = useState(initialData.contactEmail || "");
const [contactPhone, setContactPhone] = useState(initialData.contactPhone || "");
```

Update the `handleSubmit` function to include the new fields:

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);
  await onSubmit({ title, location, date, logo, contactEmail: contactEmail || null, contactPhone: contactPhone || null });
  setLoading(false);
}
```

Add the new fields in the form JSX, before the `<Button>` submit:

```tsx
<Input
  label="Email de contact (retrait badge)"
  type="email"
  value={contactEmail}
  onChange={(e) => setContactEmail(e.target.value)}
  placeholder="contact@example.com"
/>
<Input
  label="Téléphone de contact (retrait badge)"
  type="tel"
  value={contactPhone}
  onChange={(e) => setContactPhone(e.target.value)}
  placeholder="+229 97 00 00 00"
/>
```

- [ ] **Step 2: Update EventPage interface**

In `src/app/admin/event/page.tsx`, update the `EventData` interface:

```typescript
interface EventData {
  title: string;
  location: string;
  date: string;
  logo: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}
```

- [ ] **Step 3: Update Event API PUT handler**

In `src/app/api/event/route.ts`, update the PUT handler to include the new fields:

```typescript
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { title, location, date, logo, contactEmail, contactPhone } = await req.json();

  const existing = await prisma.event.findFirst();
  if (!existing) {
    const event = await prisma.event.create({ data: { title, location, date, logo, contactEmail, contactPhone } });
    return NextResponse.json(event);
  }

  const event = await prisma.event.update({
    where: { id: existing.id },
    data: { title, location, date, logo, contactEmail, contactPhone },
  });
  return NextResponse.json(event);
}
```

- [ ] **Step 4: Verify the app compiles**

Run: `npx tsc --noEmit`

Expected: No type errors

---

### Task 6: Add "Mark as Printed" Button on Registration Detail Page

**Files:**
- Modify: `src/app/admin/registrations/[id]/page.tsx`

- [ ] **Step 1: Update Registration interface**

In `src/app/admin/registrations/[id]/page.tsx`, add the new fields to the `Registration` interface:

```typescript
interface Registration {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  structure: string;
  photo: string | null;
  idDocumentType: string;
  idDocumentNumber: string;
  idDocument: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  badgePrinted: boolean;
  badgePrintedAt: string | null;
  createdAt: string;
  team: { id: string; name: string; color: string };
}
```

- [ ] **Step 2: Add markAsPrinted function**

Add this function after the `updateStatus` function:

```typescript
async function markAsPrinted() {
  await fetch(`/api/registrations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ badgePrinted: true }),
  });
  const res = await fetch(`/api/registrations/${id}`);
  setRegistration(await res.json());
}
```

- [ ] **Step 3: Add badge printed indicator and button in the profile card**

In the profile card section (border-t px-6 py-4 flex gap-3 justify-center), add the print button and indicator. Replace the existing action buttons div:

```tsx
<div className="border-t px-6 py-4 flex flex-col items-center gap-3">
  <div className="flex gap-3">
    {registration.status !== "APPROVED" && (
      <Button onClick={() => updateStatus("APPROVED")}>Valider</Button>
    )}
    {registration.status !== "REJECTED" && (
      <Button variant="danger" onClick={() => updateStatus("REJECTED")}>Rejeter</Button>
    )}
  </div>
  {registration.status === "APPROVED" && !registration.badgePrinted && (
    <Button variant="secondary" onClick={markAsPrinted}>
      Marquer comme imprimé
    </Button>
  )}
  {registration.badgePrinted && registration.badgePrintedAt && (
    <p className="text-sm text-green-600">
      Badge imprimé le {new Date(registration.badgePrintedAt).toLocaleDateString("fr-FR")}
    </p>
  )}
</div>
```

- [ ] **Step 4: Verify the app compiles**

Run: `npx tsc --noEmit`

Expected: No type errors

---

### Task 7: Add Batch Print to Registrations List Page

**Files:**
- Modify: `src/app/admin/registrations/page.tsx`

- [ ] **Step 1: Update Registration interface**

In `src/app/admin/registrations/page.tsx`, update the interface:

```typescript
interface Registration {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  structure: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  badgePrinted: boolean;
  badgePrintedAt: string | null;
  createdAt: string;
  team: { name: string; color: string };
}
```

- [ ] **Step 2: Add selection state and batch print handler**

Add these after the existing `useState` declarations:

```typescript
const [selected, setSelected] = useState<Set<string>>(new Set());
const [printing, setPrinting] = useState(false);
const [printFilter, setPrintFilter] = useState<string>("");

function toggleSelect(id: string) {
  setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function toggleSelectAll() {
  const printableIds = filtered
    .filter((r) => r.status === "APPROVED" && !r.badgePrinted)
    .map((r) => r.id);
  if (printableIds.every((id) => selected.has(id))) {
    setSelected((prev) => {
      const next = new Set(prev);
      printableIds.forEach((id) => next.delete(id));
      return next;
    });
  } else {
    setSelected((prev) => {
      const next = new Set(prev);
      printableIds.forEach((id) => next.add(id));
      return next;
    });
  }
}

async function batchPrint() {
  if (selected.size === 0) return;
  setPrinting(true);
  await fetch("/api/registrations/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: Array.from(selected) }),
  });
  setSelected(new Set());
  await fetchRegistrations();
  setPrinting(false);
}
```

- [ ] **Step 3: Update filter logic**

Replace the existing `filtered` const:

```typescript
const filtered = registrations.filter((r) => {
  if (statusFilter && r.status !== statusFilter) return false;
  if (teamFilter && r.team.name !== teamFilter) return false;
  if (printFilter === "printed" && !r.badgePrinted) return false;
  if (printFilter === "not_printed" && (r.badgePrinted || r.status !== "APPROVED")) return false;
  return true;
});
```

- [ ] **Step 4: Add print filter dropdown and batch button**

Add after the existing team filter `<select>` in the filter bar:

```tsx
<select
  className="px-3 py-2 border rounded text-sm"
  value={printFilter}
  onChange={(e) => setPrintFilter(e.target.value)}
>
  <option value="">Impression</option>
  <option value="printed">Imprimé</option>
  <option value="not_printed">Non imprimé</option>
</select>
{selected.size > 0 && (
  <Button onClick={batchPrint} disabled={printing}>
    {printing ? "Envoi..." : `Marquer comme imprimés (${selected.size})`}
  </Button>
)}
```

- [ ] **Step 5: Add checkbox column to table**

Add a checkbox header in `<thead>`:

```tsx
<tr className="border-b bg-gray-50">
  <th className="px-4 py-3 w-10">
    <input
      type="checkbox"
      onChange={toggleSelectAll}
      checked={
        filtered.filter((r) => r.status === "APPROVED" && !r.badgePrinted).length > 0 &&
        filtered
          .filter((r) => r.status === "APPROVED" && !r.badgePrinted)
          .every((r) => selected.has(r.id))
      }
    />
  </th>
  <th className="text-left px-4 py-3">Nom</th>
  <th className="text-left px-4 py-3">Structure</th>
  <th className="text-left px-4 py-3">Équipe</th>
  <th className="text-left px-4 py-3">Statut</th>
  <th className="text-left px-4 py-3">Badge</th>
  <th className="text-right px-4 py-3">Actions</th>
</tr>
```

Add a checkbox cell and badge status cell in `<tbody>` rows:

```tsx
{filtered.map((reg) => (
  <tr key={reg.id} className="border-b hover:bg-gray-50">
    <td className="px-4 py-3">
      {reg.status === "APPROVED" && !reg.badgePrinted && (
        <input
          type="checkbox"
          checked={selected.has(reg.id)}
          onChange={() => toggleSelect(reg.id)}
        />
      )}
    </td>
    <td className="px-4 py-3">
      <Link href={`/admin/registrations/${reg.id}`} className="text-blue-600 hover:underline font-medium">
        {reg.lastName} {reg.firstName}
      </Link>
    </td>
    <td className="px-4 py-3">{reg.structure}</td>
    <td className="px-4 py-3">
      <span className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: reg.team.color }} />
        {reg.team.name}
      </span>
    </td>
    <td className="px-4 py-3"><StatusBadge status={reg.status} /></td>
    <td className="px-4 py-3">
      {reg.badgePrinted ? (
        <span className="text-xs text-green-600 font-medium">Imprimé</span>
      ) : reg.status === "APPROVED" ? (
        <span className="text-xs text-orange-500">Non imprimé</span>
      ) : (
        <span className="text-xs text-gray-400">—</span>
      )}
    </td>
    <td className="px-4 py-3 text-right space-x-2">
      {reg.status === "APPROVED" && (
        <Link href={`/badge-preview/${reg.id}`} target="_blank">
          <Button variant="secondary">Voir badge</Button>
        </Link>
      )}
      {reg.status === "PENDING" && (
        <>
          <Button variant="primary" onClick={() => updateStatus(reg.id, "APPROVED")}>Valider</Button>
          <Button variant="danger" onClick={() => updateStatus(reg.id, "REJECTED")}>Rejeter</Button>
        </>
      )}
    </td>
  </tr>
))}
```

- [ ] **Step 6: Verify the app compiles**

Run: `npx tsc --noEmit`

Expected: No type errors

---

### Task 8: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`

Expected: All tests pass

- [ ] **Step 2: Check TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

- [ ] **Step 3: Visual verification**

Start the dev server and verify:
1. `/admin/event` — contact email and phone fields appear and save correctly
2. `/admin/registrations` — checkboxes, badge status column, print filter, batch button work
3. `/admin/registrations/[id]` — "Marquer comme imprimé" button appears for approved, non-printed registrations
4. After marking as printed, notification email is sent (check Mailpit at port 8025)
