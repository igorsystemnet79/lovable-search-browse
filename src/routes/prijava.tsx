import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ponudimi } from "@/integrations/standalone/client";
import { AuthShell, inputCls, btnCls } from "@/components/auth-shell";

export const Route = createFileRoute("/prijava")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Prijava — PonudiMi" },
      { name: "description", content: "Prijavi se na svoj PonudiMi nalog." },
      { property: "og:title", content: "Prijava — PonudiMi" },
      { property: "og:description", content: "Prijavi se na svoj PonudiMi nalog." },
    ],
  }),
  component: Prijava,
});

function porukaGreske(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message.includes("Missing PonudiMi API environment")) {
      return "Povezivanje sa servisom za naloge nije podešeno. Proveri da li je samostalni PonudiMi API pokrenut.";
    }
    if (/failed to fetch|network|fetch failed/i.test(error.message)) {
      return "Nije moguće povezati se sa servisom. Proveri internet vezu i pokušaj ponovo.";
    }
    return error.message || fallback;
  }
  return fallback;
}

function Prijava() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [lozinka, setLozinka] = useState("");
  const [prikaziLozinku, setPrikaziLozinku] = useState(false);
  const [greska, setGreska] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setGreska("");
    setInfo("");
    try {
      const { error } = await ponudimi.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: lozinka,
      });
      if (error) {
        if (/invalid login credentials/i.test(error.message)) {
          setGreska("Email ili lozinka nisu ispravni. Ako još nemaš nalog, prvo se registruj.");
        } else if (/email not confirmed/i.test(error.message)) {
          setGreska("Email adresa još nije potvrđena. Proveri prijemno sanduče.");
        } else {
          setGreska(porukaGreske(error, "Prijava trenutno nije moguća. Pokušaj ponovo."));
        }
        return;
      }
      await navigate({ to: "/" });
    } catch (error) {
      setGreska(porukaGreske(error, "Došlo je do greške prilikom prijave. Pokušaj ponovo."));
    } finally {
      setBusy(false);
    }
  }

  async function zaboravljena() {
    if (!email.trim()) {
      setGreska("Upiši email adresu pa klikni ponovo.");
      return;
    }
    setGreska("");
    setInfo("");
    try {
      const { error } = await ponudimi.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-lozinke`,
      });
      if (error) throw error;
      setInfo("Ako je ova email adresa registrovana, zahtev za promenu lozinke je obrađen. Proveri prijemno sanduče i spam.");
    } catch (error) {
      setGreska(porukaGreske(error, "Slanje linka za promenu lozinke trenutno nije moguće."));
    }
  }

  async function google() {
    setGreska("Google prijava nije podešena na ovoj samostalnoj instalaciji. Prijavi se email adresom i lozinkom.");
  }

  return (
    <AuthShell title="Prijava" subtitle="Dobrodošao nazad!">
      <form onSubmit={onSubmit} className="space-y-3">
        <input className={inputCls} type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="relative">
          <input className={`${inputCls} pr-12`} type={prikaziLozinku ? "text" : "password"} required autoComplete="current-password" placeholder="Lozinka" value={lozinka} onChange={(e) => setLozinka(e.target.value)} />
          <button
            type="button"
            onClick={() => setPrikaziLozinku((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label={prikaziLozinku ? "Sakrij lozinku" : "Prikaži lozinku"}
            aria-pressed={prikaziLozinku}
          >
            {prikaziLozinku ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.1-2.2 3.1" />
                <path d="M6.2 6.2C3.9 7.6 2.8 9.5 2.5 12c1 2.5 4.5 7 9.5 7 1.1 0 2.1-.2 3-.6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            )}
          </button>
        </div>
        {greska && <p role="alert" className="text-sm text-destructive">{greska}</p>}
        {info && <p role="status" className="text-sm text-brand">{info}</p>}
        <button className={btnCls} disabled={busy}>{busy ? "Prijavljivanje..." : "Prijavi se"}</button>
      </form>
      <button type="button" onClick={google} className="mt-3 w-full rounded-full border border-input px-4 py-3 text-sm font-medium hover:bg-secondary">
        Nastavi sa Google nalogom
      </button>
      <div className="mt-4 flex justify-between text-sm">
        <button type="button" onClick={zaboravljena} className="text-muted-foreground hover:underline">Zaboravljena lozinka?</button>
        <Link to="/registracija" className="font-semibold text-brand hover:underline">Napravi nalog</Link>
      </div>
    </AuthShell>
  );
}
