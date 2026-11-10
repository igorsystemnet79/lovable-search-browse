import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ponudimi } from "@/integrations/standalone/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BackLink } from "@/components/back-link";
import { PonudaItem, ZahtevItem } from "@/components/listing-items";
import { kategorije as podrazumevaneKategorije } from "@/lib/kategorije";
import { ucitajKategorije } from "@/integrations/standalone/client";
import type { Ponuda, Zahtev } from "@/lib/listings";

export const Route = createFileRoute("/kategorija/$slug")({
  head: () => ({ meta: [{ property: "og:type", content: "website" },{ name: "twitter:card", content: "summary_large_image" },{ title: "Kategorija — PonudiMi" },{ name: "description", content: "Ponude i zahtevi u izabranoj kategoriji." }] }),
  notFoundComponent: () => (
    <div className="container-page py-20 text-center">
      <h1 className="text-2xl font-bold">Kategorija nije pronađena</h1>
      <Link to="/" className="mt-4 inline-block text-brand hover:underline">← Početna</Link>
    </div>
  ),
  errorComponent: () => <div className="container-page py-20 text-center">Greška pri učitavanju.</div>,
  component: KategorijaPage,
});

function KategorijaPage() {
  const { slug } = Route.useParams();
  const { data: loadedCategories=podrazumevaneKategorije, isLoading: categoriesLoading }=useQuery({queryKey:["platform-categories"],queryFn:ucitajKategorije,staleTime:60_000});
  const kat=loadedCategories.find(category=>category.slug===slug);
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["kategorija", slug],
    queryFn: async () => {
      const [p, z] = await Promise.all([
        ponudimi.from("ponude").select("*").ilike("kategorija", `%${kat?.naziv||""}%`).order("created_at", { ascending: false }),
        ponudimi.from("zahtevi").select("*").ilike("kategorija", `%${kat.naziv}%`).order("created_at", { ascending: false }),
      ]);
      if (p.error) throw p.error;
      if (z.error) throw z.error;
      return { ponude: p.data as Ponuda[], zahtevi: z.data as Zahtev[] };
    },
    enabled: !authLoading && !!user && !!kat,
  });

  if(categoriesLoading)return <div className="container-page py-20 text-center text-sm text-muted-foreground">Učitavanje kategorije...</div>;
  if(!kat)return <div className="container-page py-20 text-center"><h1 className="text-2xl font-bold">Kategorija nije pronađena</h1><Link to="/" className="mt-4 inline-block text-brand hover:underline">← Početna</Link></div>;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="container-page relative isolate">
        <img src={kat.slika} alt={kat.naziv} className="h-56 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand/90 via-brand/60 to-transparent" />
        <div className="absolute inset-0 flex items-center px-5">
          <div className="text-brand-foreground">
            <BackLink className="text-sm text-brand-foreground/80 hover:underline">← Nazad na početnu</BackLink>
            <h1 className="mt-2 text-4xl font-bold">{kat.naziv}</h1>
            <p className="mt-2 text-sm text-brand-foreground/80">{kat.podkategorije.length} potkategorija za precizniji izbor</p>
          </div>
        </div>
      </section>

      <main className="container-page py-10">
        <section aria-label={`Potkategorije: ${kat.naziv}`}>
          <h2 className="text-xl font-semibold">Izaberi potkategoriju</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {kat.podkategorije.map((pod) => (
              <Link
                key={pod}
                to="/pretraga"
                search={{ q: pod, lokacija: "" }}
                className="rounded-full border border-input bg-surface px-4 py-2 text-sm font-medium transition-colors hover:border-brand hover:bg-secondary"
              >
                {pod}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Sve glavne kategorije</h2>
          <nav className="mt-3 flex flex-wrap gap-2">
            {loadedCategories.map((k) => (
              <Link
                key={k.slug}
                to="/kategorija/$slug"
                params={{ slug: k.slug }}
                className="rounded-full border border-input px-4 py-2 text-sm font-medium hover:bg-secondary"
                activeProps={{ className: "bg-brand text-brand-foreground border-brand" }}
              >
                {k.naziv}
              </Link>
            ))}
          </nav>
        </section>

        {authLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Proveravam prijavu...</p>
        ) : !user ? (
          <section className="mt-8 rounded-2xl border border-border bg-secondary/60 p-6 text-center">
            <h2 className="text-lg font-semibold">Prijava je potrebna za pregled oglasa</h2>
            <p className="mt-2 text-sm text-muted-foreground">Registruj se besplatno ili se prijavi da pregledaš ponude i zahteve u ovoj kategoriji.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link to="/registracija" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground">Registruj se</Link>
              <Link to="/prijava" className="rounded-full border border-input px-5 py-2.5 text-sm font-semibold">Prijavi se</Link>
            </div>
          </section>
        ) : (
          <div className="mt-8 grid w-full min-w-0 grid-cols-1 gap-6">
            <article className="rounded-2xl bg-secondary/60 p-5">
              <h2 className="text-xl font-semibold">Ponude ({data?.ponude.length ?? 0})</h2>
              <ul className="mt-4 space-y-3">
                {data?.ponude.map((p) => <PonudaItem key={p.id} ponuda={p} />)}
              </ul>
              {!isLoading && !data?.ponude.length && <p className="mt-4 text-sm text-muted-foreground">Trenutno nema ponuda u ovoj kategoriji.</p>}
            </article>
            <article className="rounded-2xl bg-secondary/60 p-5">
              <h2 className="text-xl font-semibold">Zahtevi ({data?.zahtevi.length ?? 0})</h2>
              <ul className="mt-4 space-y-3">
                {data?.zahtevi.map((z) => <ZahtevItem key={z.id} zahtev={z} />)}
              </ul>
              {!isLoading && !data?.zahtevi.length && <p className="mt-4 text-sm text-muted-foreground">Trenutno nema zahteva u ovoj kategoriji.</p>}
            </article>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}