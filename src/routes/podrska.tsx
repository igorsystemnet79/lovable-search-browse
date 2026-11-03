import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ponudimi } from "@/integrations/standalone/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { inputCls, btnCls } from "@/components/auth-shell";

export const Route = createFileRoute("/podrska")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Podrška — PonudiMi" },
      { name: "description", content: "Česta pitanja i kontakt forma PonudiMi podrške." },
      { property: "og:title", content: "Podrška — PonudiMi" },
      { property: "og:description", content: "Česta pitanja i kontakt forma PonudiMi podrške." },
    ],
  }),
  component: Podrska,
});

const pitanja = [
  ["Da li je korišćenje besplatno?", "Da, registracija i objava oglasa i zahteva su besplatni."],
  ["Kako da objavim oglas?", "Registruj se, prijavi se i klikni na „Objavi oglas“ na početnoj strani."],
  ["Kako da postavim zahtev?", "Klikni na „Postavi zahtev“ i opiši šta tražiš — prodavci će ti se javiti."],
  ["Zaboravio sam lozinku.", "Na strani Prijava upiši email i klikni „Zaboravljena lozinka?“."],
];

function Podrska() {
  const [f, setF] = useState({ ime: "", email: "", poruka: "" });
  const [status, setStatus] = useState<"" | "ok" | "err">("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await ponudimi.from("poruke_podrske").insert(f);
    setStatus(error ? "err" : "ok");
    if (!error) setF({ ime: "", email: "", poruka: "" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page grid gap-8 py-12 lg:grid-cols-2">
        <section>
          <h1 className="text-3xl font-bold">Podrška</h1>
          <p className="mt-2 text-sm text-muted-foreground">Odgovori na najčešća pitanja.</p>
          <div className="mt-6 space-y-3">
            {pitanja.map(([q, a]) => (
              <details key={q} className="rounded-2xl bg-surface p-5 shadow-card">
                <summary className="cursor-pointer font-semibold">{q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-surface p-8 shadow-card">
          <h2 className="text-xl font-semibold">Pošalji nam poruku</h2>
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <input className={inputCls} required maxLength={100} placeholder="Ime" value={f.ime} onChange={(e) => setF({ ...f, ime: e.target.value })} />
            <input className={inputCls} type="email" required maxLength={255} placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <textarea className={`${inputCls} min-h-36`} required maxLength={2000} placeholder="Tvoja poruka" value={f.poruka} onChange={(e) => setF({ ...f, poruka: e.target.value })} />
            {status === "ok" && <p className="text-sm text-brand">Hvala! Javićemo ti se uskoro.</p>}
            {status === "err" && <p className="text-sm text-destructive">Slanje nije uspelo, pokušaj ponovo.</p>}
            <button className={btnCls}>Pošalji</button>
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
