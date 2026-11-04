import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ListingFormDialog, type ListingKind } from "@/components/listing-form-dialog";

import heroImage from "@/assets/hero-home.jpg";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SearchPanel } from "@/components/search-panel";
import { PonudaItem, ZahtevItem } from "@/components/listing-items";
import { ponudeQuery, zahteviQuery } from "@/lib/listings";
import { kategorije } from "@/lib/kategorije";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "PonudiMi — kupuj i prodaj jednostavno" },
      {
        name: "description",
        content: "PonudiMi — pronađi ono što ti treba ili ponudi ono što imaš.",
      },
      { property: "og:title", content: "PonudiMi — kupuj i prodaj jednostavno" },
      {
        property: "og:description",
        content: "Kupi, prodaj i pronađi ono što ti treba — brzo i jednostavno.",
      },
    ],
  }),
  component: Index,
});


function Index() {
  const [listingKind, setListingKind] = useState<ListingKind | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ponudimi-listing-draft");
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.kind === "ponuda" || draft.kind === "zahtev") setListingKind(draft.kind);
    } catch { /* Draft restoration is optional. */ }
  }, []);
  const ponude = useQuery(ponudeQuery(5));
  const zahtevi = useQuery(zahteviQuery(5));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main>
        <section className="relative isolate">
          <img
            src={heroImage}
            alt="Par pregledava ponude telefonom i laptopom ispred moderne kuće"
            width={1920}
            height={1088}
            className="h-[380px] w-full object-cover sm:h-[460px]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand/90 via-brand/60 to-transparent" />
          <div className="container-page absolute inset-0 flex items-center">
            <div className="max-w-xl text-brand-foreground">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-highlight">
                Ponude na jednom mestu
              </p>
              <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Pronađi pravu ponudu za sebe.</h1>
              <p className="mt-4 text-base text-brand-foreground/80">
                Kupi, prodaj i pronađi ono što ti treba — brzo i jednostavno.
              </p>
            </div>
          </div>
        </section>

        <section aria-label="Pretraga oglasa" className="container-page -mt-10 relative z-10">
          <SearchPanel newTab />
        </section>

        <div className="container-page">
          <section className="mt-12 grid gap-4 sm:grid-cols-2">
            <Button
              onClick={() => setListingKind("zahtev")}
              className="h-auto whitespace-normal flex items-center justify-between gap-4 rounded-2xl bg-brand p-6 text-left text-brand-foreground shadow-card hover:bg-brand/90"
            >
              <div>
                <h2 className="text-xl font-semibold">Postavi zahtev</h2>
                <p className="mt-1 text-sm text-brand-foreground/70">Napiši šta tražiš.</p>
              </div>
              <span aria-hidden="true" className="text-2xl">
                →
              </span>
            </Button>

            <Button
              onClick={() => setListingKind("ponuda")}
              className="h-auto whitespace-normal flex items-center justify-between gap-4 rounded-2xl bg-highlight p-6 text-left text-highlight-foreground shadow-card hover:bg-highlight/90"
            >
              <div>
                <h2 className="text-xl font-semibold">Objavi oglas</h2>
                <p className="mt-1 text-sm text-highlight-foreground/70">Ponudi proizvod ili uslugu.</p>
              </div>
              <span aria-hidden="true" className="text-2xl">
                →
              </span>
            </Button>
          </section>

          <section className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-2xl font-semibold">Istraži kategorije</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pregledaj aktuelne ponude u kategoriji koja te zanima.
                </p>
              </div>
              <span className="text-sm font-medium text-muted-foreground">Popularne kategorije</span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {kategorije.map((kat) => (
                <Link
                  key={kat.slug}
                  to="/kategorija/$slug"
                  params={{ slug: kat.slug }}
                  className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-card transition-transform hover:-translate-y-1"
                >
                  <img
                    src={kat.slika}
                    alt={kat.naziv}
                    loading="lazy"
                    className="h-28 w-full object-cover"
                  />
                  <span className="block px-3 py-3 text-sm font-medium">{kat.naziv}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-14 grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            <article className="w-full min-w-0 overflow-hidden rounded-2xl bg-secondary/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Najnoviji zahtevi</h2>
                <Link to="/zahtevi" className="text-sm font-semibold text-brand hover:underline">
                  Pogledaj sve →
                </Link>
              </div>
              <ul className="mt-4 w-full min-w-0 space-y-3">
                {zahtevi.data?.map((z) => <ZahtevItem key={z.id} zahtev={z} compact featured />)}
              </ul>
            </article>

            <article className="w-full min-w-0 overflow-hidden rounded-2xl bg-secondary/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Istaknute ponude</h2>
                <Link to="/ponude" className="text-sm font-semibold text-brand hover:underline">
                  Prikaži još →
                </Link>
              </div>
              <ul className="mt-4 w-full min-w-0 space-y-3">
                {ponude.data?.map((p) => <PonudaItem key={p.id} ponuda={p} compact featured />)}
              </ul>
            </article>
          </section>
        </div>
      </main>

      <SiteFooter />
      <ListingFormDialog kind={listingKind} onClose={() => setListingKind(null)} />
    </div>
  );
}
