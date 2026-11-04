import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BackLink } from "@/components/back-link";
import { ZahtevItem } from "@/components/listing-items";
import { zahteviQuery } from "@/lib/listings";

export const Route = createFileRoute("/zahtevi")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Svi zahtevi — PonudiMi" },
      { name: "description", content: "Pregledaj sve aktuelne zahteve korisnika na PonudiMi." },
      { property: "og:title", content: "Svi zahtevi — PonudiMi" },
      {
        property: "og:description",
        content: "Pregledaj sve aktuelne zahteve korisnika na PonudiMi.",
      },
    ],
  }),
  component: ZahteviPage,
});

function ZahteviPage() {
  const { data, isLoading } = useQuery(zahteviQuery());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="container-page py-10">
        <BackLink className="text-sm text-muted-foreground hover:underline">
          ← Nazad na početnu
        </BackLink>
        <h1 className="mt-4 text-3xl font-bold">Svi zahtevi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isLoading ? "Učitavanje..." : `Ukupno ${data?.length ?? 0} zahteva.`}
        </p>

        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {data?.map((z) => <ZahtevItem key={z.id} zahtev={z} compact />)}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}
