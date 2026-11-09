import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/politika-privatnosti")({
  head: () => ({
    meta: [
      { title: "Politika privatnosti — PonudiMi" },
      { name: "description", content: "Obaveštenje o obradi podataka o ličnosti na platformi PonudiMi." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PolitikaPrivatnosti,
});

const stavke = [
  {
    title: "Ko obrađuje podatke",
    text: "Rukovalac podacima: [OBAVEZNO UNETI PUNO POSLOVNO IME ILI IME PREDUZETNIKA, SEDIŠTE, ADRESU, MATIČNI BROJ I PIB]. Kontakt za pitanja o privatnosti: [UNETI SLUŽBENU E-MAIL ADRESU]. Ovi podaci moraju biti popunjeni i provereni pre javnog puštanja platforme.",
  },
  {
    title: "Koje podatke prikupljamo",
    text: "U zavisnosti od korišćenja platforme, obrađuju se podaci koje korisnik unese pri registraciji (ime, prezime, korisničko ime, e-mail, telefon, mesto i adresa), podaci o pravnom licu (naziv firme i PIB), sadržaj oglasa i zahteva, fotografije, podaci iz komunikacije sa podrškom, prijave sadržaja, evidencija prihvatanja pravila i obaveštenja, kao i tehnički podaci neophodni za bezbednost i rad sistema (npr. IP adresa, tip pregledača i vreme pristupa).",
  },
  {
    title: "Zašto obrađujemo podatke",
    text: "Podaci se koriste za kreiranje i održavanje korisničkog naloga, prikaz i upravljanje oglasima i zahtevima, povezivanje korisnika, podršku, sprečavanje prevara i zloupotreba, bezbednost, proveru poslovnih podataka u APR-u, vođenje evidencije prihvatanja pravila i ispunjavanje zakonskih obaveza. Za svaku svrhu rukovalac mora utvrditi i dokumentovati odgovarajući pravni osnov u skladu sa Zakonom o zaštiti podataka o ličnosti.",
  },
  {
    title: "Pravni osnov",
    text: "U zavisnosti od konkretne obrade, pravni osnov može biti izvršenje ugovora ili preduzimanje radnji na zahtev lica pre zaključenja ugovora, ispunjenje zakonske obaveze, legitimni interes rukovaoca ili saglasnost kada je ona odgovarajući osnov. Saglasnost za marketinške poruke, ako se takva funkcija uvede, mora biti posebna, dobrovoljna i opoziva i ne sme biti uslov za registraciju.",
  },
  {
    title: "Ko može dobiti podatke",
    text: "Pristup podacima imaju ovlašćeni administratori i lica kojima je pristup potreban za rad platforme. Podaci se mogu obrađivati preko ugovornih pružalaca hostinga, infrastrukture, e-mail isporuke, čuvanja fotografija i drugih tehničkih usluga. Pre objave ove politike potrebno je navesti stvarne pružaoce usluga, njihove uloge, lokacije obrade i eventualne prenose podataka van Republike Srbije.",
  },
  {
    title: "Koliko dugo čuvamo podatke",
    text: "Podaci se čuvaju samo onoliko dugo koliko je potrebno za svrhu obrade, trajanje naloga, rešavanje sporova i ispunjavanje zakonskih obaveza. Rukovalac mora pre javnog puštanja da utvrdi konkretne rokove čuvanja za naloge, oglase, poruke, prijave, bezbednosne zapise i evidenciju prihvatanja, kao i postupak brisanja ili anonimizacije po isteku tih rokova.",
  },
  {
    title: "Prava lica",
    text: "Lice na koje se podaci odnose može, pod uslovima propisanim zakonom, tražiti pristup, ispravku, brisanje, ograničenje obrade, prenosivost i uložiti prigovor, kao i povući saglasnost kada se obrada zasniva na saglasnosti. Lice može podneti pritužbu Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti. Zahtevi se podnose na: [UNETI SLUŽBENU E-MAIL ADRESU ZA ZAŠTITU PRIVATNOSTI].",
  },
  {
    title: "Bezbednost i incidenti",
    text: "Primenjuju se tehničke i organizacione mere zaštite, uključujući kontrolu pristupa, zaštitu lozinki, ograničavanje administratorskih ovlašćenja, rezervne kopije i praćenje bezbednosnih događaja. U slučaju povrede podataka rukovalac postupa u skladu sa zakonskim obavezama obaveštavanja Poverenika i lica na koja se podaci odnose, kada su za to ispunjeni uslovi.",
  },
  {
    title: "Maloletna lica",
    text: "Registracija na PonudiMi namenjena je punoletnim licima. Korisnik pri registraciji potvrđuje da ima najmanje 18 godina. Ako rukovalac sazna da je nalog otvorilo maloletno lice, postupaće u skladu sa zakonom i internim pravilima zaštite.",
  },
  {
    title: "Kolačići i lokalno skladište",
    text: "Platforma koristi tehničko skladište pregledača za održavanje korisničke sesije i osnovnih funkcija. Ako se uvedu analitički, marketinški ili drugi neobavezni kolačići ili alati za praćenje, korisnik mora dobiti odgovarajuće informacije i mogućnost izbora pre njihovog aktiviranja, kada je to propisano.",
  },
  {
    title: "Izmene obaveštenja",
    text: "Izmene obaveštenja objavljuju se na ovoj stranici uz oznaku nove verzije i datum stupanja na snagu. Kada je to potrebno, korisnici će biti posebno obavešteni o značajnim promenama.",
  },
];

function PolitikaPrivatnosti() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page py-10">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold">Obaveštenje o privatnosti</h1>
          <p className="mt-2 text-sm text-muted-foreground">PonudiMi · radna verzija nacrt-1.0</p>
          <div role="alert" className="mt-6 rounded-2xl border border-amber-400 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <p className="font-semibold">Ovo obaveštenje još nije spremno za konačnu javnu primenu.</p>
            <p className="mt-1">Pre javnog puštanja platforme obavezno je uneti identitet i kontakt rukovaoca, potvrditi stvarne pružaoce infrastrukture, lokacije obrade i rokove čuvanja, kao i izvršiti pravnu proveru dokumenta. Polja u uglastim zagradama nisu podaci koje treba ostaviti u konačnoj verziji.</p>
          </div>
          <p className="mt-6 text-sm leading-7 text-muted-foreground">
            Ovim obaveštenjem objašnjava se kako PonudiMi prikuplja, koristi, čuva i štiti podatke o ličnosti. Obaveštenje se odnosi na posetioce i registrovane korisnike platforme.
          </p>
          <div className="mt-6 space-y-4">
            {stavke.map((item, index) => (
              <section key={item.title} className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
                <p className="text-xs font-bold tracking-widest text-muted-foreground">ODELJAK {String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-1 text-lg font-semibold">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.text}</p>
              </section>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link to="/pravila-platforme" className="font-semibold text-brand hover:underline">Pravila platforme</Link>
            <Link to="/registracija" className="font-semibold text-brand hover:underline">Nazad na registraciju</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
