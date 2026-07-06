import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadPublicEventBySlug, PublicEventError, type PublicEventBundle } from "@/lib/public-event";
import { PublicEventLayout } from "@/components/public/PublicEventLayout";
import { ClosedView } from "./closed";

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
  const session = await getServerSession(authOptions);

  // v2-11 : la page publique presente l'evenement. L'inscription elle-meme
  // se fait sur /e/[slug]/register apres connexion (compte participant).
  return (
    <PublicEventLayout
      event={event}
      contact={{ email: settings.contactEmail, phone: settings.contactPhone }}
    >
      <div className="space-y-6 rounded-lg border bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Inscription en ligne</h2>
          <p className="mt-1 text-sm text-neutral-600">
            L&apos;inscription nécessite un compte Badge. Vous pourrez ensuite consulter vos
            inscriptions et resoumettre votre dossier en cas de rejet.
          </p>
        </div>

        {categories.length > 0 && (
          <div>
            <p className="text-sm font-medium text-neutral-700 mb-2">
              Catégories disponibles :
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {session?.user?.id ? (
            <Link
              href={`/e/${slug}/register`}
              className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              S&apos;inscrire à cet événement
            </Link>
          ) : (
            <>
              <Link
                href={`/login?callbackUrl=/e/${slug}/register`}
                className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Se connecter pour s&apos;inscrire
              </Link>
              <Link
                href={`/register?next=/e/${slug}/register`}
                className="inline-flex items-center justify-center rounded-md border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
              >
                Créer un compte
              </Link>
            </>
          )}
        </div>
      </div>
    </PublicEventLayout>
  );
}
