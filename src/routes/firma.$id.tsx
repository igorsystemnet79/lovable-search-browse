import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/hooks/use-auth";
import { API_ORIGIN, ucitajJavniKatalogFirme } from "@/integrations/standalone/client";

export const Route = createFileRoute("/firma/$id")({
  head: () => ({ meta: [{ title: "Poslovni katalog firme — PonudiMi" }, { name: "robots", content: "noindex" }] }),
  component: FirmaKatalogPage,
});

function FirmaKatalogPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ["company-catalog-public", id],
    queryFn: () => ucitajJavniKatalogFirme(id),
    enabled: !loading && !!user && !!id,
  });
  const company = query.data?.company;
  const products = query.data?.data || [];
  return <div className="min-h-screen w-full overflow-x-hidden bg-background text-foreground"><SiteHeader/><main className="container-page mx-auto w-full py-8">
    <Link to="/pretraga" className="text-sm text-brand hover:underline">← Nazad na pretragu</Link>
    {loading || query.isLoading ? <p className="mt-8 text-sm text-muted-foreground">Učitavanje kataloga...</p> :
    !user ? <section className="mt-8 rounded-2xl border p-6 text-center"><h1 className="text-xl font-semibold">Prijava je potrebna</h1><p className="mt-2 text-sm text-muted-foreground">Prijavi se da pregledaš poslovne kataloge.</p><Link to="/prijava" className="mt-4 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground">Prijava</Link></section> :
    query.isError || !company ? <p role="alert" className="mt-8 rounded-xl border border-destructive/30 p-5 text-sm text-destructive">{(query.error as Error)?.message || "Katalog firme trenutno nije dostupan."}</p> :
    <>
      <section className="mt-5 w-full rounded-2xl bg-brand p-6 text-brand-foreground shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-foreground/70">Poslovni katalog</p>
        <h1 className="mt-2 text-3xl font-bold">{company.naziv_firme}</h1>
        {company.grad && <p className="mt-2 text-sm text-brand-foreground/80">{company.grad}</p>}
        <p className="mt-4 text-sm text-brand-foreground/80">{products.length.toLocaleString("sr-RS")} prikazanih artikala</p>
      </section>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Artikli firme</h2>{user.id===id && <Link to="/poslovni-katalog" className="text-sm font-medium text-brand hover:underline">Upravljaj svojim katalogom</Link>}</div>
      {products.length===0 ? <p className="mt-4 rounded-xl border p-5 text-sm text-muted-foreground">Firma još nije objavila artikle u katalogu.</p> :
      <div className="mt-4 flex w-full snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-3 [-webkit-overflow-scrolling:touch] sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">{products.map((item:any)=><article key={item.id} className="w-[88%] min-w-0 shrink-0 snap-center overflow-hidden rounded-2xl border border-border bg-surface shadow-card sm:w-auto sm:shrink">
        {item.slike?.[0]?.storage_path ? <img src={API_ORIGIN+item.slike[0].storage_path} alt={item.naziv} loading="lazy" className="h-44 w-full object-cover"/> : <div className="flex h-44 items-center justify-center bg-secondary text-4xl">📦</div>}
        <div className="p-4"><p className="text-xs text-muted-foreground">{item.kategorija} · {item.sifra}</p><h3 className="mt-2 font-semibold">{item.naziv}</h3>{item.opis&&<p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.opis}</p>}
          <p className="mt-3 text-lg font-bold text-brand">{item.cena==null?"Cena na upit":Number(item.cena).toLocaleString("sr-RS")+" "+item.valuta}</p>
          {item.kolicina!=null&&<p className="text-xs text-muted-foreground">Količina: {item.kolicina} {item.jedinica_mere||""}</p>}
          {item.proizvodjac&&<p className="mt-1 text-xs text-muted-foreground">Proizvođač: {item.proizvodjac}</p>}
        </div>
      </article>)}</div>}
    </>}
  </main><SiteFooter/></div>;
}
