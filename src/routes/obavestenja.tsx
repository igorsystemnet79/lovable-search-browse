import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/hooks/use-auth";
import { API_ORIGIN } from "@/integrations/standalone/client";

export const Route = createFileRoute("/obavestenja")({
  head: () => ({ meta: [{ title: "Obaveštenja — PonudiMi" }, { name: "robots", content: "noindex" }] }),
  component: ObavestenjaPage,
});

type AlertSearch = { id: string; query_text: string; category: string | null; target_type: "ponude" | "zahtevi" | "oba"; created_at: string };
type Notification = { id: string; listing_type: "ponude" | "zahtevi"; listing_id: string; listing_kind: "ponuda" | "zahtev"; title: string; message: string; created_at: string; read_at: string | null };

function ObavestenjaPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searches, setSearches] = useState<AlertSearch[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [targetType, setTargetType] = useState<"ponude" | "zahtevi" | "oba">("ponude");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const headers = useCallback(() => {
    let token = "";
    try { token = JSON.parse(localStorage.getItem("ponudimi_session") || "null")?.access_token || ""; } catch { /* Sesija možda nije dostupna. */ }
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }, []);

  const load = useCallback(async () => {
    const [a, n] = await Promise.all([
      fetch(`${API_ORIGIN}/api/alert-searches`, { cache: "no-store", headers: headers() }),
      fetch(`${API_ORIGIN}/api/notifications`, { cache: "no-store", headers: headers() }),
    ]);
    const ad = await a.json(); const nd = await n.json();
    if (!a.ok) throw new Error(ad.error || "Sačuvane pretrage trenutno nisu dostupne.");
    if (!n.ok) throw new Error(nd.error || "Obaveštenja trenutno nisu dostupna.");
    setSearches(ad.data || []); setNotifications(nd.data || []); setUnread(Number(nd.unread || 0));
  }, [headers]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/prijava" }); }, [loading, user, navigate]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = async () => { try { await load(); } catch (e) { if (active) setError(e instanceof Error ? e.message : "Učitavanje nije uspelo."); } };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user?.id, load]);

  async function addSearch(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`${API_ORIGIN}/api/alert-searches`, { method: "POST", headers: headers(), body: JSON.stringify({ query_text: query.trim(), category: category.trim(), target_type: targetType }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kriterijum nije sačuvan.");
      setQuery(""); setCategory(""); setSuccess("Pretraga je sačuvana. Obavestićemo te kada se pojavi odgovarajuća nova objava.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Čuvanje nije uspelo."); }
    finally { setBusy(false); }
  }

  async function removeSearch(id: string) {
    try {
      const response = await fetch(`${API_ORIGIN}/api/alert-searches/${encodeURIComponent(id)}`, { method: "DELETE", headers: headers() });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Brisanje nije uspelo.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Brisanje nije uspelo."); }
  }

  async function markAllRead() {
    try {
      const response = await fetch(`${API_ORIGIN}/api/notifications/read-all`, { method: "PATCH", headers: headers() });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Obaveštenja nisu označena.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Izmena nije uspela."); }
  }

  async function openNotification(item: Notification) {
    if (!item.read_at) {
      try { await fetch(`${API_ORIGIN}/api/notifications/${encodeURIComponent(item.id)}/read`, { method: "PATCH", headers: headers() }); } catch { /* Otvaranje oglasa ima prednost nad statusom pročitanog. */ }
    }
    navigate({ to: "/oglas/$kind/$id", params: { kind: item.listing_kind, id: item.listing_id } });
  }

  const typeLabel = (value: AlertSearch["target_type"]) => value === "ponude" ? "Nove ponude" : value === "zahtevi" ? "Novi zahtevi" : "Ponude i zahtevi";

  return <div className="min-h-screen bg-background text-foreground">
    <SiteHeader />
    <main className="container-page max-w-4xl py-8 sm:py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Obaveštenja i sačuvane pretrage</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Sačuvaj šta tražiš ili šta nudiš. PonudiMi će te obavestiti kada se pojavi nova odgovarajuća ponuda ili potražnja. Važi jednako za fizička lica i firme.</p>
      {loading && <p className="mt-5 text-sm text-muted-foreground">Provera prijave…</p>}
      {!loading && !user && <p className="mt-5 text-sm">Za korišćenje obaveštenja <Link to="/prijava" className="font-semibold text-brand underline">prijavi se</Link>.</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {success && <p role="status" className="mt-5 rounded-xl bg-brand/10 p-3 text-sm text-brand">{success}</p>}

      {user && <div className="mt-7 grid gap-6">
        <section className="rounded-2xl border border-input bg-surface p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Sačuvaj kriterijum pretrage</h2>
          <p className="mt-1 text-sm text-muted-foreground">Primer: „PVC stolarija“, „polovni traktor“ ili „adaptacija kupatila“. Kategorija je dodatni filter.</p>
          <form onSubmit={addSearch} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-medium">Proizvod, usluga ili ključne reči
              <input value={query} onChange={e => setQuery(e.target.value)} minLength={2} maxLength={160} className="h-11 rounded-lg border border-input bg-background px-3" placeholder="Šta tražiš ili nudiš?" />
            </label>
            <label className="grid gap-1 text-sm font-medium">Kategorija ili potkategorija (opciono)
              <input value={category} onChange={e => setCategory(e.target.value)} maxLength={160} className="h-11 rounded-lg border border-input bg-background px-3" placeholder="Npr. Građevina / Stolarija" />
            </label>
            <label className="grid gap-1 text-sm font-medium">Kada želiš obaveštenje?
              <select value={targetType} onChange={e => setTargetType(e.target.value as typeof targetType)} className="h-11 rounded-lg border border-input bg-background px-3">
                <option value="ponude">Kada neko objavi odgovarajuću ponudu</option>
                <option value="zahtevi">Kada neko objavi odgovarajuću potražnju</option>
                <option value="oba">Za nove ponude i nove potražnje</option>
              </select>
            </label>
            <button type="submit" disabled={busy || (query.trim().length < 2 && !category.trim())} className="min-h-11 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">{busy ? "Čuvanje…" : "Sačuvaj pretragu"}</button>
          </form>
        </section>

        <section className="rounded-2xl border border-input bg-surface p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold">Moje sačuvane pretrage</h2><p className="text-sm text-muted-foreground">Aktivni kriterijumi za automatsko povezivanje.</p></div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{searches.length} / 30</span>
          </div>
          <div className="mt-4 grid gap-2">
            {searches.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-input p-3">
              <div className="min-w-0"><p className="break-words text-sm font-semibold">{item.query_text || "Sve u kategoriji"}</p><p className="mt-1 text-xs text-muted-foreground">{item.category || "Sve kategorije"} · {typeLabel(item.target_type)}</p></div>
              <button type="button" onClick={() => removeSearch(item.id)} className="rounded-full border border-input px-3 py-2 text-xs font-semibold hover:bg-secondary">Obriši</button>
            </div>)}
            {!searches.length && <p className="rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">Još nemaš sačuvanih pretraga. Dodaj kriterijum iznad da bi dobijao relevantna obaveštenja.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-input bg-surface p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold">Nova obaveštenja</h2><p className="text-sm text-muted-foreground">{unread ? `${unread} nepročitanih` : "Nema nepročitanih obaveštenja"}</p></div>
            {unread > 0 && <button type="button" onClick={markAllRead} className="text-sm font-semibold text-brand underline">Označi sva kao pročitana</button>}
          </div>
          <div className="mt-4 grid gap-2">
            {notifications.map(item => <button type="button" key={item.id} onClick={() => openNotification(item)} className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-secondary/60 ${item.read_at ? "border-input bg-background" : "border-brand/40 bg-brand/5"}`}>
              <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{item.title}</p>{!item.read_at && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="Nepročitano" />}</div>
              <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">{item.listing_type === "ponude" ? "Nova ponuda" : "Nova potražnja"} · {new Date(item.created_at).toLocaleString("sr-RS")}</p>
            </button>)}
            {!notifications.length && <p className="rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">Kada se pojavi objava koja odgovara tvojoj sačuvanoj pretrazi, ovde ćeš dobiti obaveštenje.</p>}
          </div>
        </section>
      </div>}
    </main>
    <SiteFooter />
  </div>;
}
