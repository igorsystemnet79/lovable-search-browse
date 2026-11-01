import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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
    if (error.message.includes("Missing Supabase environment")) {
      return "Povezivanje sa servisom za naloge nije podešeno. Potrebno je povezati Supabase u Lovable Cloud-u.";
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
      const { error } = await supabase.auth.signInWithPassword({
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
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-lozinke`,
      });
      if (error) throw error;
      setInfo("Poslali smo ti email sa linkom. Otvori ga (proveri i spam) — vodi te na stranu gde upisuješ novu lozinku.");
    } catch (error) {
      setGreska(porukaGreske(error, "Slanje linka za promenu lozinke trenutno nije moguće."));
    }
  }

  async function google() {
    if (busy) return;
    setGreska("");
    try {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (r.error) throw r.error;
      if (!r.redirected) await navigate({ to: "/" });
    } catch (error) {
      setGreska(porukaGreske(error, "Prijava preko Google-a trenutno nije moguća."));
    }
  }

  return (
    <AuthShell title="Prijava" subtitle="Dobrodošao nazad!">
      <form onSubmit={onSubmit} className="space-y-3">
        <input className={inputCls} type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls} type="password" required autoComplete="current-password" placeholder="Lozinka" value={lozinka} onChange={(e) => setLozinka(e.target.value)} />
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
