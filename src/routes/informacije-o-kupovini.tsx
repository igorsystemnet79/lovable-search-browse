import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/informacije-o-kupovini")({
  head: () => ({
    meta: [
      { title: "Informacije o prodavcima i kupovini — PonudiMi" },
      { name: "description", content: "Status prodavca i podela obaveza između prodavca i platforme PonudiMi." },
    ],
  }),
  component: InformacijeOKupovini,
});

function InformacijeOKupovini() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold">Ko je prodavac i ko je za šta odgovoran?</h1>
          <p className="mt-2 text-sm text-muted-foreground">Važne informacije pre nego što stupiš u kontakt ili dogovoriš kupovinu.</p>
          <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-semibold">Uloga PonudiMi platforme</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">PonudiMi pruža onlajn tržište za objavljivanje ponuda i zahteva, pretragu, prikaz oglasa, korisničke naloge i kanale za prijavu sadržaja. Oglas objavljuje korisnik koji nudi robu ili uslugu. PonudiMi nije prodavac te robe ili usluge i ne zaključuje kupoprodajni ugovor u ime korisnika, osim ako je u konkretnoj ponudi izričito navedeno drugačije.</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Ovo obaveštenje ne isključuje niti ograničava zakonske obaveze PonudiMi platforme koje joj neposredno pripadaju, uključujući postupanje po prijavama i zakonitim nalozima nadležnih organa.</p>
          </section>
          <section className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-semibold">Ako je prodavac trgovac</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Kada se korisnik izjasni da ponudu objavljuje kao trgovac u okviru registrovane delatnosti, taj korisnik je odgovoran za tačnost opisa, stanje i svojstva robe ili usluge, cenu, dostupnost, uslove plaćanja i isporuke, izdavanje računa kada je propisano, saobraznost, reklamacije, garancije i druga prava potrošača koja se primenjuju na konkretan ugovor.</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Kupac koji nastupa kao potrošač treba pre dogovora da proveri identitet trgovca, poslovne podatke, konačnu cenu, dodatne troškove, rok i način isporuke, kao i uslove reklamacije i odustanka od ugovora kada se primenjuju.</p>
          </section>
          <section className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-semibold">Ako je prodavac privatno lice</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">Kada se korisnik izjasni da ponudu objavljuje kao privatno lice, van poslovne delatnosti, između njega i kupca može nastati građanskopravni odnos između fizičkih lica. U tom slučaju posebna prava potrošača iz propisa o zaštiti potrošača ne primenjuju se na odnos na isti način kao kada je prodavac trgovac. I dalje važe druga primenjiva pravila, uključujući propise o obligacionim odnosima i zabranu prevare.</p>
          </section>
          <section className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
            <h2 className="font-semibold">Kako se utvrđuje status prodavca?</h2>
            <p className="mt-2">Status prikazan uz ponudu zasniva se na izjavi koju je korisnik dao prilikom registracije ili koju je naknadno ispravio administrator. Sam prikaz statusa nije potvrda da je PonudiMi nezavisno proverio sve okolnosti poslovanja korisnika. Ako primetiš netačan status ili sumnjiv oglas, prijavi ga platformi pre nego što nastaviš dogovor.</p>
          </section>
          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link to="/pravila-platforme" className="font-semibold text-brand hover:underline">Pravila platforme</Link>
            <Link to="/kriterijumi-rangiranja" className="font-semibold text-brand hover:underline">Kriterijumi rangiranja</Link>
            <Link to="/podrska" className="font-semibold text-brand hover:underline">Prijavi problem ili kontaktiraj podršku</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
