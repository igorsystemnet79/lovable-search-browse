import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import heroImage from "@/assets/hero-home.jpg";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SearchPanel } from "@/components/search-panel";
import { PonudaItem, ZahtevItem } from "@/components/listing-items";
import { ponudeQuery, zahteviQuery } from "@/lib/listings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
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

const kategorije = [
  { naziv: "Automobili", slika: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=500&h=400&fit=crop" },
  { naziv: "Nekretnine", slika: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=500&h=400&fit=crop" },
  { naziv: "Mobilni telefoni", slika: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&h=400&fit=crop" },
  { naziv: "Računari", slika: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&h=400&fit=crop" },
  { naziv: "Moda", slika: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&h=400&fit=crop" },
  { naziv: "Sport", slika: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500&h=400&fit=crop" },
  { naziv: "Posao", slika: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=500&h=400&fit=crop" },
  { naziv: "Sve za kuću", slika: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=500&h=400&fit=crop" },
  { naziv: "Kolekcionarstvo", slika: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=500&h=400&fit=crop" },
];

function Index() {
  const ponude = useQuery(ponudeQuery(5, true));
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
            <Link
              to="/zahtevi"
              className="flex items-center justify-between gap-4 rounded-2xl bg-brand p-6 text-brand-foreground shadow-card"
            >
              <div>
                <h2 className="text-xl font-semibold">Postavi zahtev</h2>
                <p className="mt-1 text-sm text-brand-foreground/70">Napiši šta tražiš.</p>
              </div>
              <span aria-hidden="true" className="text-2xl">
                →
              </span>
            </Link>

            <Link
              to="/ponude"
              className="flex items-center justify-between gap-4 rounded-2xl bg-highlight p-6 text-highlight-foreground shadow-card"
            >
              <div>
                <h2 className="text-xl font-semibold">Objavi oglas</h2>
                <p className="mt-1 text-sm text-highlight-foreground/70">Ponudi proizvod ili uslugu.</p>
              </div>
              <span aria-hidden="true" className="text-2xl">
                →
              </span>
            </Link>
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
                  key={kat.naziv}
                  to="/pretraga"
                  search={{ q: kat.naziv, lokacija: "" }}
                  className="overflow-hidden rounded-2xl bg-surface shadow-card transition-transform hover:-translate-y-1"
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

          <section className="mt-14 grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl bg-secondary/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Najnoviji zahtevi</h2>
                <Link to="/zahtevi" className="text-sm font-semibold text-brand hover:underline">
                  Pogledaj sve →
                </Link>
              </div>
              <ul className="mt-4 space-y-3">
                {zahtevi.data?.map((z) => <ZahtevItem key={z.id} zahtev={z} />)}
              </ul>
            </article>

            <article className="rounded-2xl bg-secondary/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Istaknute ponude</h2>
                <Link to="/ponude" className="text-sm font-semibold text-brand hover:underline">
                  Prikaži još →
                </Link>
              </div>
              <ul className="mt-4 space-y-3">
                {ponude.data?.map((p) => <PonudaItem key={p.id} ponuda={p} />)}
              </ul>
            </article>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
