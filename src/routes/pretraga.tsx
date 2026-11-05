import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BackLink } from "@/components/back-link";
import { SearchPanel } from "@/components/search-panel";
import { PonudaItem, ZahtevItem } from "@/components/listing-items";
import { pretragaQuery } from "@/lib/listings";
import { useAuth } from "@/hooks/use-auth";

type PretragaSearch = { q: string; lokacija: string };

export const Route = createFileRoute("/pretraga")({
  validateSearch: (search: Record<string, unknown>): PretragaSearch => ({
    q: typeof search['q'] === "string" ? search['q'] : "",
    lokacija: typeof search['lokacija'] === "string" ? search['lokacija'] : "",
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Rezultati pretrage — PonudiMi" },
      { name: "description", content: "Svi oglasi i zahtevi koji odgovaraju tvojoj pretrazi." },
      { property: "og:title", content: "Rezultati pretrage — PonudiMi" },
      {
        property: "og:description",
        content: "Svi oglasi i zahtevi koji odgovaraju tvojoj pretrazi.",
      },
    ],
  }),
  component: PretragaPage,
});

function PretragaPage() {
  const { q, lokacija } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const maskContacts = authLoading || !user;
  const { data, isLoading, isError } = useQuery(pretragaQuery(q, lokacija));

  const ukupno = (data?.ponude.length ?? 0) + (data?.zahtevi.length ?? 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="container-page py-8">
        <BackLink className="text-sm text-muted-foreground hover:underline">
          ← Nazad na početnu
        </BackLink>

        <h1 className="mt-4 text-3xl font-bold">
          {q || lokacija ? (
            <>
              Rezultati za{" "}
              <span className="text-brand">{[q, lokacija].filter(Boolean).join(" · ")}</span>
            </>
          ) : (
            "Svi oglasi i zahtevi"
          )}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {isLoading ? "Pretražujem..." : `Pronađeno ${ukupno} rezultata.`}
        </p>

        <div className="mt-6">
          <SearchPanel defaultQ={q} defaultLokacija={lokacija} />
        </div>

        {isError ? (
          <p className="mt-8 text-sm text-destructive">
            Trenutno ne možemo da učitamo rezultate. Pokušaj ponovo.
          </p>
        ) : null}

        {!isLoading && ukupno === 0 && !isError ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Nema rezultata za ovu pretragu. Probaj drugi pojam ili lokaciju.
          </p>
        ) : null}

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="text-xl font-semibold">Ponude ({data?.ponude.length ?? 0})</h2>
            <ul className="mt-4 space-y-3">
              {data?.ponude.map((p) => <PonudaItem key={p.id} ponuda={p} maskContacts={maskContacts} />)}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Zahtevi ({data?.zahtevi.length ?? 0})</h2>
            <ul className="mt-4 space-y-3">
              {data?.zahtevi.map((z) => <ZahtevItem key={z.id} zahtev={z} maskContacts={maskContacts} />)}
            </ul>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
