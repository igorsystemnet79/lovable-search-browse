import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BackLink } from "@/components/back-link";
import { SearchPanel } from "@/components/search-panel";
import { PonudaItem } from "@/components/listing-items";
import { pretragaQuery } from "@/lib/listings";

type ListingSearch = { q: string; lokacija: string; kategorija: string; minCena: string; maxCena: string; valuta: string; sort: string };

export const Route = createFileRoute("/ponude")({
  validateSearch: (search: Record<string, unknown>): ListingSearch => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
    lokacija: typeof search["lokacija"] === "string" ? search["lokacija"] : "",
    kategorija: typeof search["kategorija"] === "string" ? search["kategorija"] : "",
    minCena: typeof search["minCena"] === "string" ? search["minCena"] : "",
    maxCena: typeof search["maxCena"] === "string" ? search["maxCena"] : "",
    valuta: typeof search["valuta"] === "string" ? search["valuta"] : "",
    sort: typeof search["sort"] === "string" ? search["sort"] : "najnovije",
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sve ponude — PonudiMi" },
      { name: "description", content: "Pretraži ponude po nazivu, lokaciji, kategoriji i ceni." },
      { property: "og:title", content: "Sve ponude — PonudiMi" },
      { property: "og:description", content: "Pretraži ponude na PonudiMi." },
    ],
  }),
  component: PonudePage,
});

function PonudePage() {
  const { q, lokacija, kategorija, minCena, maxCena, valuta, sort } = Route.useSearch();
  const { data, isLoading, isError } = useQuery(pretragaQuery(q, lokacija, { kategorija, minCena, maxCena, valuta, sort }));
  const items = data?.ponude ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page py-10">
        <BackLink className="text-sm text-muted-foreground hover:underline">← Nazad na početnu</BackLink>
        <h1 className="mt-4 text-3xl font-bold">Sve ponude</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isLoading ? "Učitavanje..." : `Pronađeno ${items.length} ponuda.`}
        </p>
        <div className="mt-6">
          <SearchPanel defaultQ={q} defaultLokacija={lokacija} defaultKategorija={kategorija} defaultMinCena={minCena} defaultMaxCena={maxCena} defaultValuta={valuta} defaultSort={sort} advanced searchPath="/ponude" />
        </div>
        {isError && <p role="alert" className="mt-8 text-sm text-destructive">Trenutno ne možemo da učitamo rezultate. Pokušaj ponovo.</p>}
        {!isLoading && !isError && items.length === 0 && <p className="mt-8 text-sm text-muted-foreground">Nema rezultata za izabrane kriterijume. Promeni filtere i pokušaj ponovo.</p>}
        <ul className="mt-6 grid w-full min-w-0 grid-cols-1 gap-3">
          {items.map((item) => <PonudaItem key={item.id} ponuda={item} compact />)}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
