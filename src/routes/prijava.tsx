import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AuthShell, inputCls, btnCls } from "@/components/auth-shell";

export const Route = createFileRoute("/prijava")({
  head: () => ({
    meta: [
      { title: "Prijava — PonudiMi" },
      { name: "description", content: "Prijavi se na svoj PonudiMi nalog." },
      { property: "og:title", content: "Prijava — PonudiMi" },
      { property: "og:description", content: "Prijavi se na svoj PonudiMi nalog." },
    ],
  }),
  component: Prijava,
});

function Prijava() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [lozinka, setLozinka] = useState("");
  const [greska, setGreska] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setGreska("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: lozinka });
    setBusy(false);
    if (error) return setGreska("Pogrešan email ili lozinka, ili nalog još nije potvrđen.");
    navigate({ to: "/" });
  }

  async function zaboravljena() {
    if (!email) return setGreska("Upiši email pa klikni ponovo.");
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-lozinke` });
    setInfo("Poslali smo ti link za novu lozinku na email.");
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setGreska("Prijava preko Google-a nije uspela.");
    else if (!r.redirected) navigate({ to: "/" });
  }

  return (
    <AuthShell title="Prijava" subtitle="Dobrodošao nazad!">
      <form onSubmit={onSubmit} className="space-y-3">
        <input className={inputCls} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls} type="password" required placeholder="Lozinka" value={lozinka} onChange={(e) => setLozinka(e.target.value)} />
        {greska && <p className="text-sm text-destructive">{greska}</p>}
        {info && <p className="text-sm text-brand">{info}</p>}
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
