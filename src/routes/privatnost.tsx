import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PRIVACY_POLICY_TEXT } from "@/lib/platform-rules";

export const Route = createFileRoute("/privatnost")({
  head: () => ({
    meta: [
      { title: "Politika privatnosti — PonudiMi" },
      { name: "description", content: "Informacije o obradi i zaštiti podataka na platformi PonudiMi." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PrivatnostPage,
});

function PrivatnostPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page max-w-5xl py-10">
        <div className="mb-6 rounded-2xl bg-brand p-6 text-brand-foreground sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-foreground/70">PonudiMi · Zaštita podataka</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Politika privatnosti</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-foreground/80">Objašnjava koje podatke platforma obrađuje, zašto ih koristi, ko može da im pristupi i koja prava korisnici imaju.</p>
        </div>
        <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6">
          <strong>Napomena:</strong> Ovo je radni nacrt prilagođen trenutnim funkcijama. Pre komercijalnog puštanja potrebno je uneti tačne podatke o rukovaocu, rokovima čuvanja i pružaocima usluga, a zatim izvršiti pravnu proveru.
        </div>
        <article className="rounded-2xl bg-surface p-5 shadow-card sm:p-8">
          <div className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground sm:text-base">{PRIVACY_POLICY_TEXT}</div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
