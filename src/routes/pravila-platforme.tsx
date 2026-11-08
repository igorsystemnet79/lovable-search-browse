import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Ban, Scale, FileText, MessageCircle, AlertTriangle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/pravila-platforme")({
  head: () => ({
    meta: [
      { title: "Pravila platforme — PonudiMi" },
      {
        name: "description",
        content: "Pravila bezbednog, poštenog i odgovornog korišćenja platforme PonudiMi.",
      },
    ],
  }),
  component: PravilaPlatforme,
});

const sections = [
  {
    number: "01",
    title: "Osnovna pravila korišćenja",
    icon: ShieldCheck,
    paragraphs: [
      "PonudiMi je platforma koja povezuje lica koja nude proizvode i usluge sa licima koja ih traže. Svaki korisnik je dužan da platformu koristi savesno, zakonito, pošteno i u skladu sa njenom namenom.",
      "Korisnik mora da unosi tačne, potpune i ažurne podatke, da ima pravo da objavi oglas ili zahtev i da ne obmanjuje druge korisnike. Nije dozvoljeno korišćenje tuđeg naloga, lažno predstavljanje niti otvaranje naloga sa ciljem prevare ili zaobilaženja ograničenja.",
      "Korisnik je odgovoran za sadržaj koji objavljuje, komunikaciju koju vodi i postupke koje preduzima na osnovu kontakta ostvarenog preko platforme.",
    ],
  },
  {
    number: "02",
    title: "Zabranjeni oglasi, proizvodi i usluge",
    icon: Ban,
    paragraphs: [
      "Nije dozvoljeno objavljivanje, nuđenje, traženje, posredovanje niti reklamiranje robe, usluga ili aktivnosti čiji su prodaja, kupovina, posedovanje ili distribucija zabranjeni ili ograničeni važećim propisima, osim kada je konkretna ponuda izričito dozvoljena zakonom i pravilima platforme.",
    ],
    bullets: [
      "Narkotici, psihoaktivne supstance i oprema namenjena njihovoj nelegalnoj proizvodnji ili distribuciji.",
      "Oružje, municija, eksplozivi i drugi opasni predmeti kada je njihovo oglašavanje ili promet zabranjen ili nije dozvoljen bez posebne dozvole.",
      "Ukradena roba, predmeti nepoznatog ili nezakonitog porekla i roba čije je stavljanje u promet zabranjeno.",
      "Falsifikovana roba, kopije i proizvodi koji neovlašćeno koriste tuđe žigove, logotipe ili druga prava intelektualne svojine.",
      "Lični dokumenti, tuđi nalozi, podaci za pristup, platne kartice i drugi poverljivi podaci.",
      "Ponude koje predstavljaju piramidalne šeme, nedozvoljeno klađenje, finansijske prevare ili druge oblike nezakonitog pribavljanja novca.",
      "Sadržaj koji podstiče nasilje, terorizam, samopovređivanje, eksploataciju ili bilo koju drugu protivzakonitu aktivnost.",
    ],
  },
  {
    number: "03",
    title: "Zabranjen sadržaj i ponašanje",
    icon: AlertTriangle,
    paragraphs: [
      "Na PonudiMi nije dozvoljeno objavljivanje sadržaja niti ponašanje kojim se ugrožavaju bezbednost, dostojanstvo, prava ili ugled drugih lica, korisnika, poslovnih partnera ili same platforme.",
    ],
    bullets: [
      "Pretnje, uznemiravanje, vređanje, govor mržnje, podsticanje diskriminacije ili nasilja.",
      "Klevetničke, namerno neistinite ili zlonamerne tvrdnje o drugim licima, firmama ili platformi.",
      "Pornografski, seksualno eksplicitan ili drugi neprimeren sadržaj, naročito svaki sadržaj koji uključuje maloletna lica.",
      "Objavljivanje tuđih adresa, telefona, fotografija, dokumenata ili drugih ličnih podataka bez odgovarajućeg pravnog osnova.",
      "Lažne recenzije, izmišljene preporuke, nameštanje ocena i koordinisano manipulisanje reputacijom.",
      "Spam, masovno slanje neželjenih poruka, obmanjujuće reklame i ponavljano objavljivanje istih ili gotovo istih oglasa.",
      "Sadržaj koji narušava ugled platforme kroz lažno predstavljanje, lažne optužbe, manipulacije ili zloupotrebu njenog imena i vizuelnog identiteta.",
    ],
  },
  {
    number: "04",
    title: "Tačnost oglasa i zahteva",
    icon: FileText,
    paragraphs: [
      "Oglas mora istinito da prikazuje predmet ponude, stanje, cenu, dostupnost, lokaciju i sve druge bitne karakteristike. Fotografije moraju odgovarati predmetu oglasa. Nije dozvoljeno prikrivanje nedostataka, navođenje izmišljene cene, lažne dostupnosti ili uslova koji se naknadno menjaju bez jasnog obaveštenja.",
      "Zahtev mora opisivati stvarnu potrebu korisnika. Nije dozvoljeno postavljanje lažnih zahteva radi prikupljanja kontakata, ometanja drugih korisnika ili veštačkog podizanja aktivnosti na platformi.",
      "Korisnik ne sme da objavljuje ponudu ili zahtev u pogrešnoj kategoriji sa namerom da zaobiđe pravila ili privuče pažnju na obmanjujući način.",
    ],
  },
  {
    number: "05",
    title: "Fotografije, autorska prava i privatnost",
    icon: Scale,
    paragraphs: [
      "Korisnik sme da postavi samo fotografije, tekstove, dokumente i druge materijale za koje ima pravo korišćenja i objavljivanja. Zabranjeno je neovlašćeno preuzimanje tuđih fotografija, oglasa, opisa, logotipa ili drugih zaštićenih materijala.",
      "Korisnik ne sme da objavljuje fotografije ili podatke drugih osoba na način kojim se povređuju njihova prava, privatnost ili dostojanstvo. Posebno je zabranjeno objavljivanje ličnih dokumenata, podataka o maloletnicima i poverljivih informacija.",
      "Postavljanjem sadržaja korisnik zadržava svoja prava, ali daje PonudiMi ograničenu dozvolu da sadržaj tehnički obradi, sačuva i prikaže u meri potrebnoj za funkcionisanje platforme. Detalji o prijavi povrede prava uređeni su i posebnim pravilima o korisničkim fotografijama i sadržaju.",
    ],
  },
  {
    number: "06",
    title: "Komunikacija i bezbednost",
    icon: MessageCircle,
    paragraphs: [
      "Korisnici su dužni da komuniciraju pristojno i da ne traže od drugih lica lozinke, jednokratne kodove, podatke platnih kartica ili druge poverljive informacije.",
      "PonudiMi ne traži od korisnika da u porukama dostavljaju lozinke ili potpune podatke platnih kartica. Korisnici treba da budu oprezni sa linkovima, avansnim uplatama i ponudama koje deluju nerealno povoljno.",
      "Svaku sumnju na prevaru, lažno predstavljanje, zloupotrebu naloga ili neprimereno ponašanje treba prijaviti podršci platforme.",
    ],
  },
  {
    number: "07",
    title: "Uloga i ovlašćenja PonudiMi platforme",
    icon: ShieldCheck,
    paragraphs: [
      "Korisnici samostalno kreiraju i dostavljaju oglase i zahteve. PonudiMi obezbeđuje tehničko okruženje za njihovo objavljivanje i povezivanje korisnika; samo prisustvo oglasa na platformi ne predstavlja garanciju kvaliteta, zakonitosti, vlasništva, autentičnosti ili ispunjenja obaveza druge strane.",
      "U meri dozvoljenoj zakonom, PonudiMi može da pregleda prijavljeni sadržaj, zatraži dodatna objašnjenja, privremeno ograniči vidljivost, ukloni sadržaj, ograniči pojedine funkcije ili suspenduje nalog kada postoji osnovana sumnja na kršenje ovih pravila ili propisa.",
      "Mere se određuju prema prirodi, ozbiljnosti i ponavljanju povrede, uz poštovanje važećih zakonskih obaveza. Ova pravila ne isključuju odgovornost ili obaveze platforme koje se ne mogu isključiti ugovorom.",
    ],
  },
  {
    number: "08",
    title: "Prijava povrede pravila",
    icon: MessageCircle,
    paragraphs: [
      "Ako primetite sumnjiv oglas, zabranjen sadržaj, prevaru ili povredu prava, prijavite ga kroz odeljak Podrška izborom opcije „Pošalji upit“. Navedite link ili podatke oglasa, opis problema i informacije koje mogu pomoći proveri.",
      "PonudiMi može zatražiti dodatne informacije i preduzeti odgovarajuće mere u skladu sa zakonom i ovim pravilima. Ne šaljite nepotrebne osetljive podatke niti dokumenta koja nisu potrebna za proveru prijave.",
    ],
  },
  {
    number: "09",
    title: "Posledice kršenja pravila",
    icon: AlertTriangle,
    paragraphs: [
      "U zavisnosti od težine povrede, PonudiMi može izdati upozorenje, zatražiti izmenu oglasa, ukloniti sadržaj, privremeno ograničiti mogućnost objavljivanja ili praćenja, suspendovati nalog ili trajno onemogućiti pristup platformi kada za to postoji opravdan osnov.",
      "Kada je to primereno i dozvoljeno, korisniku može biti omogućeno da dostavi objašnjenje ili zatraži ponovno razmatranje odluke. Ništa u ovim pravilima ne ograničava pravo korisnika da se obrati nadležnim organima.",
    ],
  },
  {
    number: "10",
    title: "Izmene pravila i kontakt",
    icon: FileText,
    paragraphs: [
      "PonudiMi može ažurirati ova pravila radi usklađivanja sa propisima, razvoja funkcionalnosti i zaštite korisnika. Važeća verzija biće objavljena na ovoj stranici, uz datum poslednjeg ažuriranja. Ako je izmena bitna za korisnike, platforma će nastojati da ih o njoj obavesti na odgovarajući način.",
      "Za pitanja, prijave i dodatna objašnjenja koristite odeljak Podrška na platformi.",
    ],
  },
];

function PravilaPlatforme() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page py-8 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl bg-brand px-5 py-8 text-brand-foreground shadow-panel sm:px-9 sm:py-10">
            <div className="flex items-center gap-2 text-sm font-semibold text-highlight">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              PONUDIMI · BEZBEDNOST I POVERENJE
            </div>
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Pravila platforme</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-brand-foreground/85 sm:text-base">
              Pravila važe za sve korisnike PonudiMi platforme. Njihov cilj je da obezbede
              pošteno oglašavanje, bezbednu komunikaciju i zaštitu korisnika, njihovih prava
              i ugleda platforme.
            </p>
            <p className="mt-5 text-xs text-brand-foreground/70">Radna verzija za pregled · 8. novembar 2026.</p>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-base font-semibold">Brzi pregled</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {sections.map((section) => (
                <a
                  key={section.number}
                  href={`#pravilo-${section.number}`}
                  className="flex items-center gap-3 rounded-xl bg-secondary/70 px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  <span className="text-xs font-bold text-brand">{section.number}</span>
                  <span>{section.title}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <section
                  id={`pravilo-${section.number}`}
                  key={section.number}
                  className="scroll-mt-28 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-7"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-bold tracking-widest text-muted-foreground">PRAVILO {section.number}</p>
                      <h2 className="mt-1 text-lg font-semibold sm:text-xl">{section.title}</h2>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground sm:text-[15px]">
                    {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    {section.bullets && (
                      <ul className="list-disc space-y-2 pl-5 marker:text-brand">
                        {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                      </ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl border border-highlight/50 bg-highlight/10 p-5 text-sm leading-6">
            <p className="font-semibold text-foreground">Važno obaveštenje</p>
            <p className="mt-2 text-muted-foreground">
              Ovaj tekst je radna verzija pravila za pregled. Pre konačne javne primene potrebno
              je pravno usklađivanje sa važećim propisima Republike Srbije i konačnim Uslovima
              korišćenja i Politikom privatnosti.
            </p>
            <Link to="/podrska" className="mt-4 inline-flex font-semibold text-brand hover:underline">
              Kontaktiraj podršku →
            </Link>
          </div>
          <div className="mt-8 text-center">
            <Link to="/" className="text-sm font-semibold text-brand hover:underline">← Povratak na početnu stranu</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
