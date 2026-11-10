import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BackLink } from "@/components/back-link";
import { SearchPanel } from "@/components/search-panel";
import { PonudaItem, ZahtevItem } from "@/components/listing-items";
import { pretragaQuery } from "@/lib/listings";
import { API_ORIGIN } from "@/integrations/standalone/client";

type PretragaSearch = { q: string; lokacija: string; kategorija: string; minCena: string; maxCena: string; valuta: string; sort: string };

export const Route = createFileRoute("/pretraga")({
  validateSearch: (search: Record<string, unknown>): PretragaSearch => ({
    q: typeof search['q'] === "string" ? search['q'] : "",
    lokacija: typeof search['lokacija'] === "string" ? search['lokacija'] : "",
    kategorija: typeof search['kategorija'] === "string" ? search['kategorija'] : "",
    minCena: typeof search['minCena'] === "string" ? search['minCena'] : "",
    maxCena: typeof search['maxCena'] === "string" ? search['maxCena'] : "",
    valuta: typeof search['valuta'] === "string" ? search['valuta'] : "",
    sort: typeof search['sort'] === "string" ? search['sort'] : "najnovije",
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
  const { q, lokacija, kategorija, minCena, maxCena, valuta, sort } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading, isError } = useQuery({ ...pretragaQuery(q, lokacija, { kategorija, minCena, maxCena, valuta, sort }), enabled: !authLoading && !!user });

  const ukupno = (data?.ponude.length ?? 0) + (data?.zahtevi.length ?? 0) + (data?.artikliKataloga.length ?? 0);

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
              <span className="text-brand">{[q, lokacija, kategorija].filter(Boolean).join(" · ")}</span>
            </>
          ) : (
            "Svi oglasi i zahtevi"
          )}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {authLoading ? "Proveravam prijavu..." : !user ? "Prijava je potrebna za pretragu." : isLoading ? "Pretražujem..." : `Pronađeno ${ukupno} rezultata.`}
        </p>

        {!authLoading && !user ? (
          <section className="mt-8 rounded-2xl border border-border bg-secondary/60 p-6 text-center">
            <h2 className="text-lg font-semibold">Prijava je potrebna za pretragu</h2>
            <p className="mt-2 text-sm text-muted-foreground">Registruj se besplatno ili se prijavi da pretražuješ ponude i zahteve na platformi.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link to="/registracija" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground">Registruj se</Link>
              <Link to="/prijava" className="rounded-full border border-input px-5 py-2.5 text-sm font-semibold">Prijavi se</Link>
            </div>
          </section>
        ) : null}

        {user && <>
          <div className="mt-6">
            <SearchPanel defaultQ={q} defaultLokacija={lokacija} defaultKategorija={kategorija} defaultMinCena={minCena} defaultMaxCena={maxCena} defaultValuta={valuta} defaultSort={sort} advanced />
          </div>
          <p className="mt-3 text-right text-xs text-muted-foreground"><Link to="/kriterijumi-rangiranja" className="font-medium text-brand hover:underline">Kako se rangiraju rezultati pretrage?</Link></p>
          {isError && <p className="mt-8 text-sm text-destructive">Trenutno ne možemo da učitamo rezultate. Pokušaj ponovo.</p>}
          {!isLoading && ukupno === 0 && !isError && <p className="mt-8 text-sm text-muted-foreground">Nema rezultata za ovu pretragu. Probaj drugi pojam ili lokaciju.</p>}
          <div className="mt-10 grid w-full min-w-0 grid-cols-1 gap-8">
            <section>
              <h2 className="text-xl font-semibold">Artikli iz kataloga firmi ({data?.artikliKataloga.length ?? 0})</h2>
              <p className="mt-1 text-sm text-muted-foreground">Proizvodi iz kataloga verifikovanih firmi sa aktivnim paketom.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data?.artikliKataloga.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
                    <p className="text-xs font-medium text-muted-foreground">{item.kategorija} · Šifra: {item.sifra}</p>
                    {item.slike?.[0]?.storage_path && <img src={API_ORIGIN+item.slike[0].storage_path} alt={item.naziv} loading="lazy" className="mt-3 h-36 w-full rounded-xl object-cover"/>}
                    <h3 className="mt-2 font-semibold">{item.naziv}</h3>
                    {item.opis && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.opis}</p>}
                    <p className="mt-3 text-lg font-bold text-brand">{item.cena == null ? "Cena na upit" : `${Number(item.cena).toLocaleString("sr-RS")} ${item.valuta}`}</p>
                    {item.kolicina != null && <p className="text-xs text-muted-foreground">Dostupna količina: {item.kolicina}</p>}
                    <div className="mt-3 border-t border-border pt-3 text-sm">
                      <Link to="/firma/$id" params={{id:item.user_id}} className="font-medium text-brand hover:underline">{item.naziv_firme} · Pogledaj katalog</Link>
                      {item.grad && <p className="text-xs text-muted-foreground">{item.grad}</p>}
                      {item.proizvodjac && <p className="mt-1 text-xs text-muted-foreground">Proizvođač: {item.proizvodjac}</p>}
                    </div>
                  </article>
                ))}
                {!isLoading && !(data?.artikliKataloga.length) && <p className="text-sm text-muted-foreground">Nema artikala iz poslovnih kataloga za ovu pretragu.</p>}
              </div>
            </section>
            <section>
              <h2 className="text-xl font-semibold">Ponude ({data?.ponude.length ?? 0})</h2>
              <ul className="mt-4 space-y-3">{data?.ponude.map((p) => <PonudaItem key={p.id} ponuda={p} />)}</ul>
            </section>
            <section>
              <h2 className="text-xl font-semibold">Zahtevi ({data?.zahtevi.length ?? 0})</h2>
              <ul className="mt-4 space-y-3">{data?.zahtevi.map((z) => <ZahtevItem key={z.id} zahtev={z} />)}</ul>
            </section>
          </div>
        </>}
      </main>

      <SiteFooter />
    </div>
  );
}
