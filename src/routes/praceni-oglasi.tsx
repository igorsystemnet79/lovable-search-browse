import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PonudaItem, ZahtevItem } from "@/components/listing-items";
import { useAuth } from "@/hooks/use-auth";
import { pracenjaQuery, promenaCene } from "@/lib/my-listings";
import { formatCena } from "@/lib/listings";

export const Route = createFileRoute("/praceni-oglasi")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Praćeni oglasi — PonudiMi" },
      { name: "description", content: "Ponude i zahtevi koje pratiš na PonudiMi." },
      { property: "og:title", content: "Praćeni oglasi — PonudiMi" },
      { property: "og:description", content: "Ponude i zahtevi koje pratiš na PonudiMi." },
    ],
  }),
  component: Praceni,
});

const label = { pala: "Iznos je smanjen", porasla: "Iznos je povećan", ista: "Iznos nije promenjen" };

function Praceni() {
  const { user, loading } = useAuth();
  const q = useQuery({ ...pracenjaQuery(user?.id ?? ""), enabled: !!user });
  const ponude = q.data?.filter((f) => f.ponude) ?? [];
  const zahtevi = q.data?.filter((f) => f.zahtevi) ?? [];
  const ukupno = ponude.length + zahtevi.length;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page py-10">
        <h1 className="text-3xl font-bold">Praćeni oglasi</h1>
        {!loading && !user && <p className="mt-4">Da pratiš ponude i zahteve, <Link to="/prijava" className="font-semibold text-brand underline">prijavi se</Link>.</p>}
        {user && q.isLoading && <p className="mt-4 text-muted-foreground">Učitavanje praćenih oglasa...</p>}
        {user && !q.isLoading && ukupno === 0 && <p className="mt-4 text-muted-foreground">Trenutno ne pratiš nijednu ponudu ili zahtev. Izaberi „Prati ponudu“ ili „Prati zahtev“ ispod oglasa.</p>}
        {user && q.isError && <p className="mt-4 text-sm text-destructive">Praćeni oglasi trenutno ne mogu da se učitaju. Pokušaj ponovo.</p>}
        {ponude.length > 0 && <section className="mt-7">
          <h2 className="text-xl font-semibold">Ponude koje pratiš ({ponude.length})</h2>
          <ul className="mt-4 grid w-full min-w-0 grid-cols-1 gap-4">
            {ponude.map((f) => f.ponude && <div key={f.id}>
              <PonudaItem ponuda={f.ponude} />
              <p className="mt-2 px-4 text-sm">Kad si počeo: {formatCena(f.pocetna_cena, f.ponude.valuta)} · Sada: {formatCena(f.ponude.cena, f.ponude.valuta)} · <strong className={promenaCene(f.pocetna_cena, f.ponude.cena) === "pala" ? "text-brand" : ""}>{label[promenaCene(f.pocetna_cena, f.ponude.cena)]}</strong></p>
            </div>)}
          </ul>
        </section>}
        {zahtevi.length > 0 && <section className="mt-7">
          <h2 className="text-xl font-semibold">Zahtevi koje pratiš ({zahtevi.length})</h2>
          <ul className="mt-4 grid w-full min-w-0 grid-cols-1 gap-4">
            {zahtevi.map((f) => f.zahtevi && <div key={f.id}>
              <ZahtevItem zahtev={f.zahtevi} />
              <p className="mt-2 px-4 text-sm text-muted-foreground">Početni budžet: {formatCena(f.pocetni_budzet, f.zahtevi.valuta)} · Trenutni budžet: {formatCena(f.zahtevi.budzet, f.zahtevi.valuta)}</p>
            </div>)}
          </ul>
        </section>}
      </main>
      <SiteFooter />
    </div>
  );
}
