import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { API_ORIGIN } from "@/integrations/standalone/client";
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
      "Korisnici samostalno kreiraju oglase i zahteve i zaključuju eventualne ugovore neposredno jedni sa drugima. PonudiMi pruža tehničku uslugu objavljivanja, pretraživanja i povezivanja korisnika. Osim ako je u konkretnom slučaju izričito navedeno drugačije, PonudiMi nije prodavac, kupac, pružalac oglašene usluge, zastupnik niti ugovorna strana u poslu između korisnika.",
      "PonudiMi postupa po prijavama i zahtevima u skladu sa važećim propisima. Platforma može da zatraži dodatne informacije, ograniči vidljivost, ukloni sadržaj ili ograniči/suspenduje nalog kada za to postoji zakonski ili ugovorni osnov.",
      "Ništa u ovim pravilima ne isključuje niti ograničava odgovornost, zakonske obaveze ili prava korisnika koja se prema prinudnim propisima ne mogu isključiti ili ograničiti.",
    ],
  },
  {
    number: "08",
    title: "Prijava povrede pravila",
    icon: MessageCircle,
    paragraphs: [
      "Ako primetite sumnjiv oglas, zabranjen ili nezakonit sadržaj, prevaru ili povredu prava, prijavite ga kroz odeljak Podrška izborom opcije „Pošalji upit“. Navedite tačan link ili identifikaciju sadržaja, razlog prijave i podatke koji omogućavaju proveru. Nemojte slati nepotrebne osetljive podatke.",
      "PonudiMi razmatra prijave bez nepotrebnog odlaganja i preduzima mere u skladu sa zakonom. Kada se primenjuje član 20. Zakona o elektronskoj trgovini, po zahtevu trećeg lica za uklanjanje nedopuštenog sadržaja postupa se u zakonskom roku, po pravilu najkasnije dva radna dana od prijema zahteva, osim u zakonom predviđenom slučaju osporavanja nedopuštenosti i obraćanja nadležnom organu.",
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
      "PonudiMi može menjati ova pravila radi usklađivanja sa propisima, razvoja funkcionalnosti i zaštite korisnika. Objavljuje se važeća verzija sa datumom stupanja na snagu ili poslednjeg ažuriranja. O bitnim izmenama korisnici će biti obavešteni na primeren način. Izmene ne utiču retroaktivno na već nastala prava i obaveze, osim kada zakon nalaže drugačije ili je to dopušteno uz valjan pravni osnov.",
      "Pravila su dostupna u elektronskom obliku tako da korisnik može da ih sačuva i ponovo pregleda. Za pitanja, prijave i dodatna objašnjenja koristite odeljak Podrška na platformi.",
    ],
  },
  {
    number: "11",
    title: "Trgovci, fizička lica i prava potrošača",
    icon: Scale,
    paragraphs: [
      "Korisnik koji objavljuje ponudu dužan je da tačno označi da li nastupa kao trgovac ili preduzetnik u okviru svoje delatnosti ili kao fizičko lice koje prodaje van poslovne delatnosti. Nije dozvoljeno lažno predstavljanje statusa radi izbegavanja zakonskih obaveza.",
      "Korisnik koji nastupa kao trgovac odgovoran je za ispunjenje svih obaveza koje mu propisi nameću, uključujući jasno navođenje poslovnog imena i kontakt podataka, bitnih svojstava proizvoda ili usluge, ukupne cene sa porezima i dodatnim troškovima kada je primenljivo, načina plaćanja, isporuke, reklamacija i informacija o pravu na odustanak od ugovora kada to pravo postoji.",
      "Prava potrošača iz Zakona o zaštiti potrošača primenjuju se kada su ispunjeni zakonski uslovi, naročito kada potrošač zaključuje ugovor sa trgovcem. Prodaja između dva fizička lica koja ne nastupaju kao trgovci ne postaje potrošačka kupovina samo zato što je oglas objavljen na PonudiMi.",
      "Kada se primenjuje ugovor na daljinu između trgovca i potrošača, trgovac je dužan da pruži zakonom propisana prethodna obaveštenja i omogući ostvarivanje prava, uključujući pravo na odustanak u zakonskom roku i zakonske izuzetke. Reklamacije, saobraznost, povraćaj novca i isporuku rešava trgovac kao ugovorna strana, bez uticaja na obaveze platforme koje propisi posebno propisuju.",
      "PonudiMi može zahtevati dopunu ili ispravku podataka o statusu trgovca i ukloniti ili ograničiti ponudu koja ne sadrži obavezne ili tačne informacije."
    ],
  },
  {
    number: "12",
    title: "Podaci o ličnosti i elektronske poruke",
    icon: ShieldCheck,
    paragraphs: [
      "Lični podaci korisnika obrađuju se u skladu sa Zakonom o zaštiti podataka o ličnosti i posebnim Obaveštenjem o obradi podataka o ličnosti/Politikom privatnosti. Ova pravila ne zamenjuju to obaveštenje.",
      "Korisnik treba da dostavlja samo podatke koji su potrebni za korišćenje platforme i ne sme u javne oglase, fotografije ili poruke unositi tuđe lične podatke, kopije ličnih dokumenata, podatke o platnim karticama, lozinke ili druge poverljive podatke bez odgovarajućeg pravnog osnova.",
      "Korisnik može da ostvaruje prava koja mu pripadaju po propisima o zaštiti podataka o ličnosti, na način opisan u Politici privatnosti. Podaci se ne koriste za svrhe koje nisu navedene u odgovarajućem obaveštenju ili zasnovane na drugom zakonitom osnovu.",
      "Komercijalne poruke elektronskim putem šalju se samo kada postoji prethodni pristanak ili drugi izričit zakonski osnov. Korisniku mora biti omogućeno da opozove pristanak i prestane da prima takve poruke."
    ],
  },
  {
    number: "13",
    title: "Plaćene promocije, bezbednost i identitet pružaoca usluge",
    icon: FileText,
    paragraphs: [
      "Plaćeno isticanje, sponzorisana objava ili drugi komercijalni sadržaj mora biti jasno prepoznatljiv kao takav i ne sme dovoditi korisnika u zabludu o prirodi, poreklu ili rangiranju ponude. Uslovi, cena i trajanje plaćene usluge prikazuju se pre njenog naručivanja.",
      "Korisnici ne smeju nuditi proizvode ili usluge koji su zabranjeni, nebezbedni ili povučeni iz prometa, niti prikrivati upozorenja, nedostatke ili zakonska ograničenja. Ponuđači odgovorni su za zakonitost proizvoda i usluga koje nude.",
      "Podaci o identitetu, sedištu/adresi, registraciji i kontaktu pružaoca usluge PonudiMi, kao i podaci o načinu obraćanja i eventualnim nadležnim organima, objavljuju se na posebnoj stranici sa pravnim informacijama i održavaju ažurnim u skladu sa Zakonom o elektronskoj trgovini. Ovaj pravilnik ne zamenjuje obavezu objavljivanja tih podataka.",
      "Ova pravila ne predstavljaju pravni savet niti zamenjuju pojedinačne ugovore, Politiku privatnosti, pravila plaćenih paketa ili obavezna obaveštenja koja se moraju prikazati u konkretnom postupku naručivanja."
    ],
  },
];

export const defaultPlatformRulesText = sections.map(section => [
  `PRAVILO ${section.number} — ${section.title}`,
  ...section.paragraphs,
  ...(section.bullets || []).map(item => `• ${item}`),
].join("\n\n")).join("\n\n\n");

function PravilaPlatforme() {
  const [publishedText, setPublishedText] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`${API_ORIGIN}/api/platform-rules`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(result => { if (active && result?.data?.sadrzaj) { setPublishedText(result.data.sadrzaj); setPublishedAt(result.data.published_at || null); } })
      .catch(() => {});
    return () => { active = false; };
  }, []);
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
            <p className="mt-5 text-xs text-brand-foreground/70">{publishedAt ? `Poslednje ažuriranje · ${new Date(publishedAt).toLocaleDateString("sr-RS")}` : "Radna verzija za pregled · 8. novembar 2026."}</p>
          </div>

          {publishedText ? (
            <article className="mt-6 rounded-2xl border border-border bg-surface p-5 text-sm leading-7 text-muted-foreground shadow-card sm:p-7 whitespace-pre-wrap">{publishedText}</article>
          ) : <>
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
          </>}
          <div className="mt-8 text-center">
            <Link to="/" className="text-sm font-semibold text-brand hover:underline">← Povratak na početnu stranu</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
