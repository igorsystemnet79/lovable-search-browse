import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ListingImageGallery } from "@/components/listing-images";
import { FollowButton } from "@/components/follow-button";
import { ponudimi } from "@/integrations/standalone/client";
import { formatCena, formatVreme, type Ponuda, type Zahtev } from "@/lib/listings";

export const Route = createFileRoute("/oglas/$kind/$id")({
  beforeLoad: ({ params }) => { if (params.kind !== "ponuda" && params.kind !== "zahtev") throw notFound(); },
  component: OglasPage,
});

function OglasPage() {
  const { kind, id } = Route.useParams();
  const isOffer = kind === "ponuda";
  const { data, isLoading, isError } = useQuery({
    queryKey: ["oglas-detalj", kind, id],
    queryFn: async () => {
      const { data, error } = await ponudimi.from(isOffer ? "ponude" : "zahtevi").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Ponuda | Zahtev;
    },
  });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page py-6 sm:py-10"><div className="w-full min-w-0">
        <Link to="/" className="text-sm font-medium text-brand hover:underline">← Početna</Link>
        {isLoading && <p className="py-16 text-center text-muted-foreground">Učitavanje oglasa…</p>}
        {isError && <p className="py-16 text-center text-destructive">Oglas trenutno nije moguće učitati.</p>}
        {data && <article className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <header className="border-b border-border p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">{isOffer ? "Ponuda" : "Zahtev"} · {data.kategorija}</p>
            <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{data.naslov}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{data.lokacija} · {formatVreme(data.created_at)} · {isOffer ? formatCena((data as Ponuda).cena, data.valuta) : (data as Zahtev).budzet !== null ? "Budžet " + formatCena((data as Zahtev).budzet, data.valuta) : "Budžet nije naveden"}</p>
          </header>
          <div className="space-y-6 p-5 sm:p-7">
            <section><h2 className="mb-3 text-lg font-semibold">Fotografije</h2><ListingImageGallery kind={kind as "ponuda" | "zahtev"} id={id} /></section>
            <section><h2 className="mb-3 text-lg font-semibold">Opis oglasa</h2><p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/85">{data.opis?.trim() || "Opis nije dodat."}</p></section>
            {(data.kontakt_ime || data.telefon) && <section className="rounded-xl bg-secondary/60 p-4"><h2 className="mb-2 font-semibold">Kontakt</h2>{data.kontakt_ime && <p className="text-sm">{data.kontakt_ime}</p>}{data.telefon && <a className="text-sm font-semibold text-brand hover:underline" href={"tel:" + data.telefon.replace(/[^+0-9]/g, "")}>{data.telefon}</a>}</section>}
            <div className="border-t border-border pt-4">{isOffer ? <FollowButton ponuda={data as Ponuda} /> : <FollowButton zahtev={data as Zahtev} />}</div>
          </div>
        </article>}
      </div></main>
      <SiteFooter />
    </div>
  );
}
