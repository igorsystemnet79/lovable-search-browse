import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/kriterijumi-rangiranja")({
  head: () => ({
    meta: [
      { title: "Kriterijumi rangiranja — PonudiMi" },
      { name: "description", content: "Kako PonudiMi prikazuje i sortira rezultate pretrage." },
    ],
  }),
  component: KriterijumiRangiranja,
});

const kriterijumi = [
  ["Najnovije", "Ponude i zahtevi se prikazuju od najskorije objavljenih ka starijim."],
  ["Najstarije", "Ponude i zahtevi se prikazuju od najranije objavljenih ka novijim."],
  ["Cena / budžet: niže prvo", "Oglasi sa unetom cenom ili budžetom sortiraju se rastuće; oglasi bez unetog iznosa prikazuju se nakon oglasa sa iznosom. Kod jednakih iznosa prednost ima noviji oglas."],
  ["Cena / budžet: više prvo", "Oglasi sa unetom cenom ili budžetom sortiraju se opadajuće; oglasi bez unetog iznosa prikazuju se nakon oglasa sa iznosom. Kod jednakih iznosa prednost ima noviji oglas."],
];

function KriterijumiRangiranja() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold">Kako se rangiraju rezultati pretrage</h1>
          <p className="mt-2 text-sm text-muted-foreground">Informacije o parametrima i njihovoj relativnoj važnosti.</p>
          <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-semibold">Glavni parametar je izabrani način sortiranja</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Korisnik sam bira redosled rezultata u polju „Sortiranje“. Ako ne izabere drugu opciju, podrazumevano se koristi „Najnovije“. U okviru izabranog načina sortiranja ne koristi se skrivena ocena relevantnosti niti se redosled menja na osnovu plaćanja.</p>
            <div className="mt-4 space-y-3">
              {kriterijumi.map(([title, description], index) => (
                <div key={title} className="rounded-xl border border-input p-4">
                  <p className="font-semibold">{index + 1}. {title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-semibold">Filteri pretrage</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Ključne reči, mesto, kategorija, raspon cene ili budžeta i valuta određuju koji oglasi ulaze u rezultate. Ovi filteri ne dodaju skrivene bodove i ne menjaju izabrani redosled sortiranja.</p>
          </section>
          <section className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-semibold">Istaknute ponude i plaćene promocije</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Istaknute ponude mogu biti prikazane u posebnom, jasno označenom odeljku platforme. One ne dobijaju prednost u redosledu standardnih rezultata pretrage. Ako se u budućnosti uvede plaćeno pozicioniranje u rezultatima, ono će biti jasno označeno i ova stranica će biti ažurirana pre primene.</p>
          </section>
          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link to="/pretraga" className="font-semibold text-brand hover:underline">Nazad na pretragu</Link>
            <Link to="/pravila-platforme" className="font-semibold text-brand hover:underline">Pravila platforme</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
