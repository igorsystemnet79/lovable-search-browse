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
      { name: "description", content: "Oglasi koje pratiš i promene njihovih cena." },
      { property: "og:title", content: "Praćeni oglasi — PonudiMi" },
      { property: "og:description", content: "Oglasi koje pratiš i promene njihovih cena." },
    ],
  }),
  component: Praceni,
});

const label = { pala: "Cena je pala", porasla: "Cena je porasla", ista: "Cena nije promenjena" };

function Praceni() {
  const { user, loading } = useAuth();
  const q = useQuery({ ...pracenjaQuery(user?.id ?? ""), enabled: !!user });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page py-10">
        <h1 className="text-3xl font-bold">Praćeni oglasi</h1>
        {!loading && !user && <p className="mt-4">Da pratiš oglase, <Link to="/prijava" className="font-semibold text-brand underline">prijavi se</Link>.</p>}
        {user && q.data?.length === 0 && <p className="mt-4 text-muted-foreground">Ne pratiš nijedan oglas. Klikni „Prati oglas“ ispod ponude.</p>}
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {q.data?.map((f) => (
            <div key={f.id}>
              {f.ponude && <>
                <PonudaItem ponuda={f.ponude} />
                <p className="mt-2 px-4 text-sm">
                  Početna cena: {formatCena(f.pocetna_cena, f.ponude.valuta)} · Sada: {formatCena(f.ponude.cena, f.ponude.valuta)} ·{" "}
                  <strong className={promenaCene(f.pocetna_cena, f.ponude.cena) === "pala" ? "text-brand" : ""}>{label[promenaCene(f.pocetna_cena, f.ponude.cena)]}</strong>
                </p>
              </>}
              {f.zahtevi && <>
                <ZahtevItem zahtev={f.zahtevi} />
                <p className="mt-2 px-4 text-sm">
                  Početni budžet: {formatCena(f.pocetni_budzet, f.zahtevi.valuta)} · Sada: {formatCena(f.zahtevi.budzet, f.zahtevi.valuta)} ·{" "}
                  <strong className={promenaCene(f.pocetni_budzet, f.zahtevi.budzet) === "pala" ? "text-brand" : ""}>{label[promenaCene(f.pocetni_budzet, f.zahtevi.budzet)]}</strong>
                </p>
              </>}
            </div>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
