import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ponudimi } from "@/integrations/standalone/client";
import { AuthShell, inputCls, btnCls } from "@/components/auth-shell";
import { ispravanPib } from "@/lib/pib";

export const Route = createFileRoute("/registracija")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Registracija — PonudiMi" },
      { name: "description", content: "Napravi besplatan PonudiMi nalog i počni da oglašavaš." },
      { property: "og:title", content: "Registracija — PonudiMi" },
      { property: "og:description", content: "Napravi besplatan PonudiMi nalog i počni da oglašavaš." },
    ],
  }),
  component: Registracija,
});

function porukaGreske(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("Missing PonudiMi API environment")) {
      return "Povezivanje sa servisom za naloge nije podešeno. Proveri da li je samostalni PonudiMi API pokrenut.";
    }
    if (/failed to fetch|network|fetch failed/i.test(error.message)) {
      return "Nije moguće povezati se sa servisom. Proveri internet vezu i pokušaj ponovo.";
    }
    if (/already registered|user already exists/i.test(error.message)) {
      return "Ova email adresa je već registrovana. Pokušaj da se prijaviš.";
    }
    return error.message || "Registracija trenutno nije moguća. Pokušaj ponovo.";
  }
  return "Registracija trenutno nije moguća. Pokušaj ponovo.";
}

function Registracija() {
  const navigate = useNavigate();
  const [tip, setTip] = useState<"fizicko" | "pravno">("fizicko");
  const [f, setF] = useState({ ime: "", prezime: "", telefon: "", grad: "", adresa: "", email: "", lozinka: "", naziv_firme: "", pib: "" });
  const [greska, setGreska] = useState("");
  const [uspeh, setUspeh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prikaziLozinku, setPrikaziLozinku] = useState(false);
  const [prihvatioPravila, setPrihvatioPravila] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!prihvatioPravila) return setGreska("Za registraciju je potrebno da prihvatiš Pravilnik o ponašanju i potvrdiš da si pročitao Politiku privatnosti.");
    const email = f.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setGreska("Unesi ispravnu email adresu.");
    if (f.lozinka.length < 8) return setGreska("Lozinka mora imati najmanje 8 karaktera.");
    if (f.ime.trim().length < 2 || f.prezime.trim().length < 2) return setGreska("Ime i prezime su obavezni.");
    if (f.grad.trim().length < 2) return setGreska("Mesto stanovanja je obavezno.");
    if (!/^[+0-9 ()-]{6,30}$/.test(f.telefon.trim()) || f.telefon.replace(/[^0-9]/g, "").length < 6) return setGreska("Unesi ispravan broj telefona.");
    if (tip === "pravno") {
      if (f.naziv_firme.trim().length < 2) return setGreska("Unesi naziv firme.");
      if (!ispravanPib(f.pib)) return setGreska("PIB nije ispravan (9 cifara sa ispravnom kontrolnom cifrom).");
    }
    setBusy(true);
    setGreska("");
    try {
      const { data, error } = await ponudimi.auth.signUp({
        email,
        password: f.lozinka,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            ime: f.ime.trim(),
            prezime: f.prezime.trim(),
            telefon: f.telefon.trim(),
            grad: f.grad.trim(),
            adresa: f.adresa.trim(),
            tip_lica: tip,
            pravila_prihvacena: true,
            punoletstvo_potvrdjeno: true,
            politika_privatnosti_potvrdjena: true,
            ...(tip === "pravno" ? { naziv_firme: f.naziv_firme.trim(), pib: f.pib.replace(/\s/g, "") } : {}),
          },
        },
      });
      if (error) throw error;
      if (data.pending_verification) {
        setUspeh(true);
      } else if (!data.user) {
        setGreska("Registracija nije potvrđena. Proveri podešavanja servisa i pokušaj ponovo.");
        return;
      }
      setUspeh(true);
    } catch (error) {
      setGreska(porukaGreske(error));
    } finally {
      setBusy(false);
    }
  }

  if (uspeh)
    return (
      <AuthShell title="Nalog je uspešno kreiran" subtitle="Dobro došao na PonudiMi!">
        <p className="text-sm">Registracija je završena. Možeš odmah da nastaviš na platformu — potvrda e-mail adrese i telefona trenutno nije potrebna.</p>
        {tip === "pravno" && <p className="mt-3 text-sm text-muted-foreground">Podaci o firmi mogu biti dodatno provereni kroz APR.</p>}
        <button type="button" onClick={() => navigate({ to: "/" })} className={btnCls + " mt-4"}>Nastavi na PonudiMi</button>
      </AuthShell>
    );

  const tab = (v: "fizicko" | "pravno", label: string) => (
    <button type="button" onClick={() => setTip(v)} className={`flex-1 rounded-full px-4 py-2 text-sm font-medium ${tip === v ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}>{label}</button>
  );

  return (
    <AuthShell title="Registracija" subtitle="Napravi besplatan nalog za par sekundi.">
      <div className="mb-4 flex rounded-full border border-input p-1">{tab("fizicko", "Fizičko lice")}{tab("pravno", "Pravno lice")}</div>
      <form onSubmit={onSubmit} className="space-y-3">
        {tip === "pravno" && (
          <>
            <input className={inputCls} required maxLength={150} placeholder="Naziv firme" value={f.naziv_firme} onChange={set("naziv_firme")} />
            <input className={inputCls} required inputMode="numeric" maxLength={9} placeholder="PIB (9 cifara)" value={f.pib} onChange={set("pib")} />
          </>
        )}
        <input className={inputCls} required maxLength={60} autoComplete="given-name" placeholder="Ime" value={f.ime} onChange={set("ime")} />
        <input className={inputCls} required maxLength={60} autoComplete="family-name" placeholder="Prezime" value={f.prezime} onChange={set("prezime")} />
        <input className={inputCls} type="tel" required maxLength={30} autoComplete="tel" placeholder="Telefon (npr. 0641234567 ili +381641234567)" value={f.telefon} onChange={set("telefon")} />
        <input className={inputCls} required maxLength={60} autoComplete="address-level2" placeholder="Mesto stanovanja" value={f.grad} onChange={set("grad")} />
        <input className={inputCls} maxLength={150} autoComplete="street-address" placeholder={tip === "pravno" ? "Adresa sedišta (opciono)" : "Adresa (opciono)"} value={f.adresa} onChange={set("adresa")} />
        <input className={inputCls} type="email" required autoComplete="email" placeholder="Email" value={f.email} onChange={set("email")} />
        <div className="relative">
          <input
            className={inputCls + " pr-14"}
            type={prikaziLozinku ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Lozinka (min. 8 karaktera)"
            value={f.lozinka}
            onChange={set("lozinka")}
          />
          <button
            type="button"
            onClick={() => setPrikaziLozinku((trenutno) => !trenutno)}
            className="absolute right-2 top-1/2 -translate-y-1/2 min-h-10 rounded-full px-3 text-sm font-semibold text-brand hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label={prikaziLozinku ? "Sakrij lozinku" : "Prikaži lozinku"}
            aria-pressed={prikaziLozinku}
          >
            {prikaziLozinku ? "Sakrij" : "Prikaži"}
          </button>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-input p-3 text-sm leading-6">
          <input type="checkbox" required checked={prihvatioPravila} onChange={e => setPrihvatioPravila(e.target.checked)} className="mt-1 size-4 shrink-0 accent-current" />
          <span>Potvrđujem da imam najmanje 18 godina. Pročitao/la sam i prihvatam <Link to="/pravila" target="_blank" className="font-semibold text-brand underline">Pravilnik o ponašanju</Link> i potvrđujem da sam upoznat/a sa <Link to="/privatnost" target="_blank" className="font-semibold text-brand underline">Politikom privatnosti</Link>, uključujući mogućnost opravdanog i evidentiranog administratorskog pristupa privatnim razgovorima.</span>
        </label>
        {greska && <p role="alert" className="text-sm text-destructive">{greska}</p>}
        <button className={btnCls} disabled={busy}>{busy ? "Slanje..." : "Registruj se"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Već imaš nalog? <Link to="/prijava" className="font-semibold text-brand hover:underline">Prijavi se</Link>
      </p>
    </AuthShell>
  );
}
