import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/hooks/use-auth";

type BusinessPackage = {
  package_name: string;
  price_eur: number | string;
  starts_at: string;
  ends_at: string;
  days_remaining: number;
};

export const Route = createFileRoute("/moj-nalog")({
  head: () => ({ meta: [{ title: "Moj nalog — PonudiMi" }, { name: "robots", content: "noindex" }] }),
  component: MojNalogPage,
});

function MojNalogPage() {
  const { user, loading } = useAuth();
  const [activePackage, setActivePackage] = useState<BusinessPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    async function loadPackage() {
      setBusy(true);
      setError("");
      try {
        let token = "";
        try { token = JSON.parse(localStorage.getItem("ponudimi_session") || "null")?.access_token || ""; } catch { token = ""; }
        const response = await fetch("/api/packages/me", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Podaci o paketu nisu dostupni.");
        if (mounted) setActivePackage(result.data || null);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Greška pri učitavanju paketa.");
      } finally {
        if (mounted) setBusy(false);
      }
    }
    void loadPackage();
    return () => { mounted = false; };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page max-w-4xl py-10">
        <h1 className="mb-2 text-3xl font-bold">Moj nalog</h1>
        <p className="mb-6 text-sm text-muted-foreground">Pregled osnovnih podataka o nalogu i poslovnom paketu.</p>
        {loading && <p className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">Učitavanje naloga...</p>}
        {!loading && !user && <p className="rounded-xl bg-surface p-4 text-sm">Za pregled naloga potrebno je da se <Link to="/prijava" className="font-semibold text-brand underline">prijaviš</Link>.</p>}
        {user && <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-7">
          <h2 className="text-xl font-semibold">Poslovni paket</h2>
          {busy && <p className="mt-3 text-sm text-muted-foreground">Proveravam aktivni paket...</p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          {!busy && !error && !activePackage && <p className="mt-3 text-sm text-muted-foreground">Trenutno nema aktivnog poslovnog paketa povezanog sa ovim nalogom. Za informacije se obrati podršci.</p>}
          {!busy && activePackage && <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-secondary p-4"><p className="text-xs text-muted-foreground">Aktivni paket</p><p className="mt-1 font-semibold">{activePackage.package_name}</p></div>
            <div className="rounded-xl bg-secondary p-4"><p className="text-xs text-muted-foreground">Cena paketa</p><p className="mt-1 font-semibold">{Number(activePackage.price_eur).toLocaleString("sr-RS")} €</p></div>
            <div className="rounded-xl bg-secondary p-4"><p className="text-xs text-muted-foreground">Važi od</p><p className="mt-1 font-semibold">{new Date(activePackage.starts_at).toLocaleDateString("sr-RS")}</p></div>
            <div className="rounded-xl bg-secondary p-4"><p className="text-xs text-muted-foreground">Važi do</p><p className="mt-1 font-semibold">{new Date(activePackage.ends_at).toLocaleDateString("sr-RS")}</p></div>
            <div className="rounded-xl bg-secondary p-4 sm:col-span-2"><p className="text-xs text-muted-foreground">Preostalo dana</p><p className="mt-1 font-semibold">{activePackage.days_remaining}</p></div>
          </div>}
          <p className="mt-5 text-sm text-muted-foreground">Za pitanja o paketu ili produženju koristi stranicu <Link to="/podrska" className="font-semibold text-brand underline">Podrška</Link>.</p>
        </section>}
      </main>
      <SiteFooter />
    </div>
  );
}