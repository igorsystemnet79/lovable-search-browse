import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleError = params.get("google_error");
    if (googleError) {
      setGreska(googleError);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = fragment.get("google_access_token");
    if (!accessToken) return;
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    void (async () => {
      setBusy(true);
      try {
        await ponudimi.auth.setSession({ access_token: accessToken });
        await navigate({ to: "/" });
      } catch {
        setGreska("Google prijava nije završena. Pokušaj ponovo.");
      } finally {
        setBusy(false);
      }
    })();
  }, [navigate]);

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
        if ((error as any).verificationToken) {
          window.location.href = "/potvrda-email?verification_token=" + encodeURIComponent((error as any).verificationToken);
          return;
        }
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
      setInfo("Poslali smo ti email sa linkom. Otvori ga (proveri i spam) — vodi te na stranu gde upisuješ novu lozinku.");
    } catch (error) {
      setGreska(porukaGreske(error, "Slanje linka za promenu lozinke trenutno nije moguće."));
    }
  }

  async function google() {
    setGreska("");
    window.location.assign("/api/auth/google");
  }

  return (
    <AuthShell title="Prijava" subtitle="Dobrodošao nazad!">
      <form onSubmit={onSubmit} className="space-y-3">
        <input className={inputCls} type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="relative">
          <input
            className={inputCls + " pr-14"}
            type={prikaziLozinku ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Lozinka"
            value={lozinka}
            onChange={(e) => setLozinka(e.target.value)}
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
