import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, inputCls, btnCls } from "@/components/auth-shell";

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

function Registracija() {
  const [f, setF] = useState({ ime: "", telefon: "", grad: "", email: "", lozinka: "" });
  const [greska, setGreska] = useState("");
  const [uspeh, setUspeh] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setGreska("");
    const { error } = await supabase.auth.signUp({
      email: f.email,
      password: f.lozinka,
      options: {
        emailRedirectTo: window.location.origin,
        data: { ime: f.ime, telefon: f.telefon, grad: f.grad },
      },
    });
    setBusy(false);
    if (error) return setGreska(error.message.includes("registered") ? "Taj email je već registrovan." : "Registracija nije uspela. Proveri podatke.");
    setUspeh(true);
  }

  if (uspeh)
    return (
      <AuthShell title="Proveri email" subtitle="Poslali smo ti link za potvrdu naloga.">
        <p className="text-sm">Klikni na link u emailu, zatim se <Link to="/prijava" className="font-semibold text-brand hover:underline">prijavi</Link>.</p>
      </AuthShell>
    );

  return (
    <AuthShell title="Registracija" subtitle="Napravi besplatan nalog za par sekundi.">
      <form onSubmit={onSubmit} className="space-y-3">
        <input className={inputCls} required maxLength={100} placeholder="Ime i prezime" value={f.ime} onChange={set("ime")} />
        <input className={inputCls} type="tel" maxLength={30} placeholder="Telefon" value={f.telefon} onChange={set("telefon")} />
        <input className={inputCls} maxLength={60} placeholder="Grad" value={f.grad} onChange={set("grad")} />
        <input className={inputCls} type="email" required placeholder="Email" value={f.email} onChange={set("email")} />
        <input className={inputCls} type="password" required minLength={6} placeholder="Lozinka (min. 6 karaktera)" value={f.lozinka} onChange={set("lozinka")} />
        {greska && <p className="text-sm text-destructive">{greska}</p>}
        <button className={btnCls} disabled={busy}>{busy ? "Slanje..." : "Registruj se"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Već imaš nalog? <Link to="/prijava" className="font-semibold text-brand hover:underline">Prijavi se</Link>
      </p>
    </AuthShell>
  );
}
