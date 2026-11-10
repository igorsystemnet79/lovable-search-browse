import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ucitajJavnePaketeFirmi } from "@/integrations/standalone/client";

export const Route = createFileRoute("/za-firme")({
  head: () => ({ meta: [{ title: "Paketi za firme — PonudiMi" }, { name: "description", content: "Izaberi paket za predstavljanje svoje firme na platformi PonudiMi." }] }),
  component: ZaFirme,
});

function ZaFirme() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["business-package-catalog-public"], queryFn: ucitajJavnePaketeFirmi, staleTime: 60_000 });
  const packages = data?.data ?? [];
  return <div className="min-h-screen bg-background"><SiteHeader /><main className="container-page py-10 sm:py-14">
    <div className="mx-auto max-w-3xl text-center"><p className="text-sm font-semibold uppercase tracking-wider text-brand">PonudiMi za poslovne korisnike</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">Paketi za firme</h1><p className="mt-4 text-base text-muted-foreground">Izaberi paket koji odgovara potrebama tvoje firme. Aktuelne cene, trajanje i pogodnosti prikazane su u nastavku.</p></div>
    {isLoading?<p className="mt-10 text-center text-muted-foreground">Učitavanje ponude paketa...</p>:isError?<p role="alert" className="mt-10 text-center text-destructive">Ponuda paketa trenutno nije dostupna. Pokušaj ponovo kasnije.</p>:packages.length?<div className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 xl:grid-cols-4">{packages.map((item:any)=><article key={item.slug} className="flex flex-col rounded-2xl border border-input bg-surface p-5 shadow-sm"><h2 className="text-xl font-bold">{item.naziv}</h2><p className="mt-3 text-3xl font-bold tabular-nums">{Number(item.cena_eur).toLocaleString("sr-RS",{minimumFractionDigits:2,maximumFractionDigits:2})} €</p><p className="mt-1 text-sm text-muted-foreground">za {item.trajanje_meseci} {item.trajanje_meseci===1?"mesec":"meseci"}</p>{item.opis&&<p className="mt-4 text-sm leading-relaxed">{item.opis}</p>}{item.pogodnosti?.length>0&&<ul className="mt-4 flex-1 space-y-2 text-sm">{item.pogodnosti.map((feature:string,i:number)=><li key={i} className="flex gap-2"><span className="font-bold text-brand">✓</span><span>{feature}</span></li>)}</ul>}<Link to="/registracija" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90">Registruj firmu</Link></article>)}</div>:<div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-input bg-surface p-6 text-center"><h2 className="text-xl font-semibold">Ponuda paketa se priprema</h2><p className="mt-2 text-sm text-muted-foreground">Uskoro će ovde biti prikazani paketi, cene i pogodnosti za poslovne korisnike.</p></div>}
  </main><SiteFooter /></div>;
}
