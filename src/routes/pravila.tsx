import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DEFAULT_PLATFORM_RULES } from "@/lib/platform-rules";

export const Route = createFileRoute("/pravila")({
  head: () => ({
    meta: [
      { title: "Pravilnik o ponašanju — PonudiMi" },
      { name: "description", content: "Pravila bezbednog, poštenog i odgovornog korišćenja platforme PonudiMi." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PravilaPage,
});

function PravilaPage() {
  const [content, setContent] = useState(DEFAULT_PLATFORM_RULES);
  const [version, setVersion] = useState<number | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/platform-rules", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Pravilnik trenutno nije dostupan.");
        return response.json();
      })
      .then(data => {
        if (!active || !data.data?.sadrzaj) return;
        setContent(data.data.sadrzaj);
        setVersion(Number(data.data.version) || null);
        setPublishedAt(data.data.published_at || null);
      })
      .catch(() => { /* Prikazujemo ugrađenu početnu verziju ako API nije dostupan. */ });
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page max-w-5xl py-10">
        <div className="mb-6 rounded-2xl bg-brand p-6 text-brand-foreground sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-foreground/70">PonudiMi · Pravila zajednice</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Pravilnik o ponašanju</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-foreground/80">Pravila važe za sve korisnike, oglase, zahteve i privatne poruke. Njihov cilj je da PonudiMi bude bezbedno i pouzdano mesto za povezivanje kupaca i prodavaca.</p>
          {version && <p className="mt-3 text-xs text-brand-foreground/70">Objavljena verzija {version}{publishedAt ? " · " + new Date(publishedAt).toLocaleDateString("sr-RS") : ""}</p>}
        </div>
        <article className="rounded-2xl bg-surface p-5 shadow-card sm:p-8">
          <div className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground sm:text-base">{content}</div>
        </article>
        <p className="mt-5 text-sm text-muted-foreground">Za prijavu nepravilnosti ili zahtev za ponovno razmatranje odluke koristite stranicu <a href="/podrska" className="font-semibold text-brand underline">Podrška</a>.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
