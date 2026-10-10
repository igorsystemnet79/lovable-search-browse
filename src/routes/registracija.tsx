import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

function Registracija() {
  const [tip, setTip] = useState<"fizicko" | "pravno">("fizicko");
  const [f, setF] = useState({ ime: "", telefon: "", grad: "", adresa: "", email: "", lozinka: "", naziv_firme: "", pib: "" });
  const [greska, setGreska] = useState("");
  const [uspeh, setUspeh] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return setGreska("Unesi ispravnu email adresu.");
    if (!/^[+0-9 ()-]{6,30}$/.test(f.telefon.trim()) || f.telefon.replace(/[^0-9]/g, "").length < 6) return setGreska("Unesi ispravan broj telefona.");
    if (tip === "pravno") {
      if (f.naziv_firme.trim().length < 2) return setGreska("Unesi naziv firme.");
      if (!ispravanPib(f.pib)) return setGreska("PIB nije ispravan (9 cifara sa ispravnom kontrolnom cifrom).");
    }
    setBusy(true);
    setGreska("");
    const { error } = await supabase.auth.signUp({
      email: f.email,
      password: f.lozinka,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          ime: f.ime, telefon: f.telefon, grad: f.grad, adresa: f.adresa, tip_lica: tip,
          ...(tip === "pravno" ? { naziv_firme: f.naziv_firme.trim(), pib: f.pib.replace(/\s/g, "") } : {}),
        },
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
        {tip === "pravno" && <p className="mt-3 text-sm text-muted-foreground">Firma se automatski verifikuje ako je PIB pronađen u APR registru, a u suprotnom je proverava administrator.</p>}
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
        <input className={inputCls} required maxLength={100} placeholder={tip === "pravno" ? "Ime i prezime odgovornog lica" : "Ime i prezime"} value={f.ime} onChange={set("ime")} />
        <input className={inputCls} type="tel" required maxLength={30} placeholder="Telefon" value={f.telefon} onChange={set("telefon")} />
        <input className={inputCls} maxLength={60} placeholder="Grad" value={f.grad} onChange={set("grad")} />
        <input className={inputCls} maxLength={150} placeholder={tip === "pravno" ? "Adresa sedišta (ulica i broj)" : "Adresa stanovanja (ulica i broj)"} value={f.adresa} onChange={set("adresa")} />
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
