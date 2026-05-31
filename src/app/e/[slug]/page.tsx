import Script from "next/script";
import { loadPublicEventBySlug, PublicEventError, type PublicEventBundle } from "@/lib/public-event";
import { getPlatformPublicRecaptcha } from "@/lib/settings";
import { PublicEventLayout } from "@/components/public/PublicEventLayout";
import { PublicRegistrationForm } from "@/components/public/PublicRegistrationForm";
import { ClosedView } from "./closed";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoadResult =
  | { kind: "ok"; bundle: PublicEventBundle }
  | { kind: "closed" };

async function loadOrClosed(slug: string): Promise<LoadResult> {
  try {
    const bundle = await loadPublicEventBySlug(slug);
    return { kind: "ok", bundle };
  } catch (err) {
    if (err instanceof PublicEventError) {
      if (err.code === "NOT_FOUND") notFound();
      return { kind: "closed" };
    }
    throw err;
  }
}

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadOrClosed(slug);

  if (result.kind === "closed") {
    return (
      <main className="mx-auto max-w-md p-8">
        <ClosedView reason="CLOSED" />
      </main>
    );
  }

  const { event, categories, settings } = result.bundle;
  const recaptcha = await getPlatformPublicRecaptcha();
  return (
    <PublicEventLayout
      event={event}
      contact={{ email: settings.contactEmail, phone: settings.contactPhone }}
    >
      {recaptcha.recaptchaEnabled && recaptcha.recaptchaSiteKey && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${recaptcha.recaptchaSiteKey}`}
          strategy="afterInteractive"
        />
      )}
      <PublicRegistrationForm slug={slug} categories={categories} settings={recaptcha} />
    </PublicEventLayout>
  );
}
