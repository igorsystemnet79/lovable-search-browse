import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PonudaItem } from "@/components/listing-items";
import { ponudeQuery } from "@/lib/listings";

export const Route = createFileRoute("/ponude")({
  head: () => ({
    meta: [
      { title: "Sve ponude — PonudiMi" },
      { name: "description", content: "Pregledaj sve aktuelne ponude na PonudiMi." },
      { property: "og:title", content: "Sve ponude — PonudiMi" },
      { property: "og:description", content: "Pregledaj sve aktuelne ponude na PonudiMi." },
    ],
  }),
  component: PonudePage,
});

function PonudePage() {
  const { data, isLoading } = useQuery(ponudeQuery());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="container-page py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← Nazad na početnu
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Sve ponude</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isLoading ? "Učitavanje..." : `Ukupno ${data?.length ?? 0} ponuda.`}
        </p>

        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {data?.map((p) => <PonudaItem key={p.id} ponuda={p} />)}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}
