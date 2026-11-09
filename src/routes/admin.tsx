import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ponudimi } from "@/integrations/standalone/client";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { obrisiKorisnika, sinhronizujApr } from "@/lib/admin.functions";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { inputCls } from "@/components/auth-shell";
import { ClearableSearchInput } from "@/components/clearable-search-input";
import type { Tables } from "@/integrations/standalone/types";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administracija — PonudiMi" },
      { name: "description", content: "Administratorski panel platforme PonudiMi." },
      { property: "og:title", content: "Administracija — PonudiMi" },
      { property: "og:description", content: "Administratorski panel platforme PonudiMi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Profil = Tables<"profiles">;
type Uloga = "admin" | "moderator" | "user";
const tabs = ["Korisnici", "Ponude", "Zahtevi", "Poruke", "APR firme", "Platforma", "Evidencija aktivnosti"] as const;
const small = "rounded-full border border-input px-3 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50";
const danger = "rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground hover:opacity-90";

function AdminPage() {
  const { user, isAdmin, checked } = useIsAdmin();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Korisnici");

  let body;
  if (!checked) body = <p className="text-muted-foreground">Učitavanje...</p>;
  else if (!user) body = <p>Morate se <Link to="/prijava" className="font-semibold text-brand hover:underline">prijaviti</Link>.</p>;
  else if (!isAdmin) body = <p>Nemate pristup administratorskom panelu.</p>;
  else
    body = (
      <>
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-sm font-medium ${tab === t ? "bg-brand text-brand-foreground" : "border border-input hover:bg-secondary"}`}>{t}</button>
          ))}
        </div>
        {tab === "Korisnici" && <Korisnici selfId={user.id} />}
        {tab === "Ponude" && <Oglasi tabela="ponude" />}
        {tab === "Zahtevi" && <Oglasi tabela="zahtevi" />}
        {tab === "Poruke" && <Poruke />}
        {tab === "APR firme" && <Apr />}
        {tab === "Platforma" && <PlatformSettings />}
        {tab === "Evidencija aktivnosti" && <EvidencijaAktivnosti />}
      </>
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page py-10">
        <h1 className="mb-6 text-3xl font-bold">Administracija</h1>
        {body}
      </main>
      <SiteFooter />
    </div>
  );
}


function Korisnici({ selfId }: { selfId: string }) {
  const [profili, setProfili] = useState<Profil[]>([]);
  const [uloge, setUloge] = useState<Record<string, Uloga[]>>({});
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<Profil | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      ponudimi.from("profiles").select("*").order("created_at", { ascending: false }),
      ponudimi.from("user_roles").select("user_id, role"),
    ]);
    setProfili(p.data ?? []);
    const m: Record<string, Uloga[]> = {};
    for (const x of r.data ?? []) (m[x.user_id] ??= []).push(x.role);
    setUloge(m);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleUloga(id: string, role: Uloga) {
    const ima = uloge[id]?.includes(role);
    const { error } = ima
      ? await ponudimi.from("user_roles").delete().eq("user_id", id).eq("role", role)
      : await ponudimi.from("user_roles").insert({ user_id: id, role });
    setMsg(error ? "Izmena uloge nije uspela." : "Uloga izmenjena.");
    load();
  }
  async function update(id: string, patch: Partial<Profil>) {
    const { error } = await ponudimi.from("profiles").update(patch).eq("id", id);
    setMsg(error ? "Čuvanje nije uspelo." : "Sačuvano.");
    load();
  }
  async function obrisi(p: Profil) {
    if (!confirm(`Obrisati korisnika ${p.ime ?? p.email} i sve njegove oglase?`)) return;
    try { await obrisiKorisnika({ data: { userId: p.id } }); setMsg("Korisnik obrisan."); } catch { setMsg("Brisanje nije uspelo."); }
    load();
  }

  const q = filter.toLowerCase();
  const lista = profili.filter((p) => !q || [p.ime, p.prezime, p.email, p.naziv_firme, p.pib, p.telefon].some((v) => v?.toLowerCase().includes(q)));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-sm"><ClearableSearchInput className={inputCls} placeholder="Pretraga korisnika" ariaLabel="Pretraga korisnika" value={filter} onChange={setFilter} /></div>
        <span className="text-sm text-muted-foreground">Ukupno: {profili.length}</span>
        {msg && <span className="text-sm text-brand">{msg}</span>}
      </div>
      <div className="space-y-3">
        {lista.map((p) => {
          const r = uloge[p.id] ?? [];
          return (
            <div key={p.id} className="rounded-2xl bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-semibold">{[p.ime, p.prezime].filter(Boolean).join(" ") || "—"} <span className="font-normal text-muted-foreground">· {p.email}</span></p>
                  <p className="text-muted-foreground">
                    {p.tip_lica === "pravno" ? `Pravno lice: ${p.naziv_firme ?? "—"}, PIB ${p.pib ?? "—"} ${p.firma_verifikovana ? "✔ verifikovano" : "✖ nije verifikovano"}` : "Fizičko lice"}
                    {" · "}{p.telefon ?? "bez telefona"}{" · "}{[p.grad, p.adresa].filter(Boolean).join(", ") || "bez adrese"}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className={p.email_confirmed_at ? "font-semibold text-green-700" : "font-semibold text-destructive"}>{p.email_confirmed_at ? `E-mail potvrđen · ${new Date(p.email_confirmed_at).toLocaleString("sr-RS")}` : "E-mail nije potvrđen"}</span>
                    <span className={p.telefon_verifikovan_at ? "font-semibold text-green-700" : "font-semibold text-destructive"}>{p.telefon_verifikovan_at ? `Telefon potvrđen · ${new Date(p.telefon_verifikovan_at).toLocaleString("sr-RS")}` : "Telefon nije potvrđen"}</span>
                    {p.email_confirmed_at && p.telefon_verifikovan_at && <span className="font-bold text-green-700">VERIFIKOVAN KORISNIK</span>}
                    {p.duplikat_sumnja && <span className="font-semibold text-amber-700">PROVERITI MOGUĆI DUPLIKAT</span>}
                    {p.blokiran && <span className="font-semibold text-destructive">BLOKIRAN</span>}
                    <span>Uloge: {r.join(", ") || "nema"}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={small} onClick={() => setEdit(p)}>Izmeni</button>
                  {p.duplikat_sumnja && <button className={small} onClick={() => update(p.id, { duplikat_sumnja: false })}>Označi kao provereno</button>}
                  <button className={small} disabled={p.id === selfId} onClick={() => toggleUloga(p.id, "admin")}>{r.includes("admin") ? "Ukini admina" : "Daj admina"}</button>
                  <button className={small} onClick={() => toggleUloga(p.id, "moderator")}>{r.includes("moderator") ? "Ukini moderatora" : "Daj moderatora"}</button>
                  <button className={small} disabled={p.id === selfId} onClick={() => update(p.id, { blokiran: !p.blokiran })}>{p.blokiran ? "Vrati sve privilegije" : "Ukini sve privilegije"}</button>
                  {p.tip_lica === "pravno" && <button className={small} onClick={() => update(p.id, { firma_verifikovana: !p.firma_verifikovana })}>{p.firma_verifikovana ? "Poništi verifikaciju" : "Verifikuj firmu"}</button>}
                  {p.id !== selfId && <button className={danger} onClick={() => obrisi(p)}>Obriši</button>}
                </div>
              </div>
              {edit?.id === p.id && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {(["ime", "prezime", "telefon", "grad", "adresa", "naziv_firme", "pib"] as const).map((k) => (
                    <input key={k} className={inputCls} placeholder={k} value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value || null })} />
                  ))}
                  <select className={inputCls} value={edit.tip_lica} onChange={(e) => setEdit({ ...edit, tip_lica: e.target.value })}>
                    <option value="fizicko">Fizičko lice</option>
                    <option value="pravno">Pravno lice</option>
                  </select>
                  <div className="flex gap-2">
                    <button className={small} onClick={() => { const { id, ime, prezime, telefon, grad, adresa, naziv_firme, pib, tip_lica } = edit; update(id, { ime, prezime, telefon, grad, adresa, naziv_firme, pib, tip_lica }); setEdit(null); }}>Sačuvaj</button>
                    <button className={small} onClick={() => setEdit(null)}>Otkaži</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Oglas = { id: string; naslov: string; opis: string | null; lokacija: string; kontakt_ime: string | null; telefon: string | null; created_at: string; cena?: number | null; budzet?: number | null };

function Oglasi({ tabela }: { tabela: "ponude" | "zahtevi" }) {
  const [rows, setRows] = useState<Oglas[]>([]);
  const [edit, setEdit] = useState<Oglas | null>(null);
  const [msg, setMsg] = useState("");
  const polje = tabela === "ponude" ? "cena" : "budzet";
  const load = useCallback(async () => {
    const { data } = await ponudimi.from(tabela).select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Oglas[]);
  }, [tabela]);
  useEffect(() => { load(); }, [load]);

  async function sacuvaj() {
    if (!edit) return;
    const iznos = edit[polje];
    const patch = { naslov: edit.naslov, opis: edit.opis, lokacija: edit.lokacija, kontakt_ime: edit.kontakt_ime, telefon: edit.telefon, [polje]: iznos === undefined || iznos === null || Number.isNaN(iznos) ? null : iznos };
    const { error } = await ponudimi.from(tabela).update(patch as never).eq("id", edit.id);
    setMsg(error ? "Čuvanje nije uspelo." : "Sačuvano.");
    setEdit(null);
    load();
  }
  async function obrisi(id: string) {
    if (!confirm("Obrisati ovaj oglas?")) return;
    const { error } = await ponudimi.from(tabela).delete().eq("id", id);
    setMsg(error ? "Brisanje nije uspelo." : "Obrisano.");
    load();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Ukupno: {rows.length} {msg && <span className="text-brand">· {msg}</span>}</p>
      {rows.map((o) => (
        <div key={o.id} className="rounded-2xl bg-surface p-4 shadow-card">
          {edit?.id === o.id ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputCls} value={edit.naslov} onChange={(e) => setEdit({ ...edit, naslov: e.target.value })} />
              <input className={inputCls} value={edit.lokacija} onChange={(e) => setEdit({ ...edit, lokacija: e.target.value })} />
              <input className={inputCls} placeholder="Kontakt" value={edit.kontakt_ime ?? ""} onChange={(e) => setEdit({ ...edit, kontakt_ime: e.target.value })} />
              <input className={inputCls} placeholder="Telefon" value={edit.telefon ?? ""} onChange={(e) => setEdit({ ...edit, telefon: e.target.value })} />
              <input className={inputCls} type="number" min={0} placeholder={tabela === "ponude" ? "Cena" : "Budžet"} value={edit[polje] ?? ""} onChange={(e) => setEdit({ ...edit, [polje]: e.target.value === "" ? null : Number(e.target.value) })} />
              <textarea className={`${inputCls} sm:col-span-2`} rows={3} value={edit.opis ?? ""} onChange={(e) => setEdit({ ...edit, opis: e.target.value })} />
              <div className="flex gap-2"><button className={small} onClick={sacuvaj}>Sačuvaj</button><button className={small} onClick={() => setEdit(null)}>Otkaži</button></div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold">{o.naslov}</p>
                <p className="text-muted-foreground">{o.lokacija} · {o.kontakt_ime ?? "—"} · {o.telefon ?? "—"} · {o[polje] ?? "po dogovoru"}</p>
              </div>
              <div className="flex gap-2"><button className={small} onClick={() => setEdit(o)}>Izmeni</button><button className={danger} onClick={() => obrisi(o.id)}>Obriši</button></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Poruke() {
  const [rows, setRows] = useState<Tables<"poruke_podrske">[]>([]);
  const load = useCallback(async () => {
    const { data } = await ponudimi.from("poruke_podrske").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-muted-foreground">Nema poruka.</p>}
      {rows.map((m) => (
        <div key={m.id} className="flex items-start justify-between gap-3 rounded-2xl bg-surface p-4 text-sm shadow-card">
          <div><p className="font-semibold">{m.ime} · {m.email}</p><p className="mt-1 whitespace-pre-wrap">{m.poruka}</p></div>
          <button className={danger} onClick={async () => { if (confirm("Obrisati poruku?")) { await ponudimi.from("poruke_podrske").delete().eq("id", m.id); load(); } }}>Obriši</button>
        </div>
      ))}
    </div>
  );
}

function Apr() {
  const [broj, setBroj] = useState(0);
  const [firme, setFirme] = useState<Tables<"apr_firme">[]>([]);
  const [zadnja, setZadnja] = useState<Tables<"apr_sinhronizacije"> | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const term = q.trim().replace(/[%_,()]/g, "");
    let query = ponudimi.from("apr_firme").select("*", { count: "exact" }).order("naziv").limit(100);
    if (term) query = query.or(`naziv.ilike.%${term}%,pib.ilike.%${term}%,maticni_broj.ilike.%${term}%`);
    const [f, s] = await Promise.all([query, ponudimi.from("apr_sinhronizacije").select("*").order("created_at", { ascending: false }).limit(1)]);
    setFirme(f.data ?? []);
    setBroj(f.count ?? 0);
    setZadnja(s.data?.[0] ?? null);
  }, [q]);
  useEffect(() => { load(); }, [load]);

  async function sync() {
    setBusy(true);
    setMsg("");
    try { const r = await sinhronizujApr(); setMsg(r.poruka); } catch { setMsg("Sinhronizacija nije uspela."); }
    setBusy(false);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={sync} disabled={busy} className="rounded-full bg-highlight px-5 py-2 text-sm font-semibold text-highlight-foreground hover:opacity-90 disabled:opacity-60">{busy ? "Sinhronizacija..." : "Sinhronizuj sa APR-om"}</button>
        <div className="w-full max-w-xs"><ClearableSearchInput className={inputCls} placeholder="Naziv, PIB ili matični broj" ariaLabel="Pretraga APR firmi" value={q} onChange={setQ} /></div>
        <span className="text-sm text-muted-foreground">Firmi u bazi: {broj}{zadnja && ` · poslednja sinhronizacija: ${new Date(zadnja.created_at).toLocaleString("sr-RS")} (${zadnja.uspeh ? "uspešna" : zadnja.poruka})`}</span>
      </div>
      {msg && <p className="mb-3 text-sm text-brand">{msg}</p>}
      <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground"><tr><th className="p-3">Naziv</th><th className="p-3">PIB</th><th className="p-3">Matični broj</th><th className="p-3">Sedište</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {firme.map((f) => (<tr key={f.pib} className="border-t border-input"><td className="p-3">{f.naziv}</td><td className="p-3">{f.pib}</td><td className="p-3">{f.maticni_broj}</td><td className="p-3">{[f.sediste, f.adresa].filter(Boolean).join(", ")}</td><td className="p-3">{f.status}</td></tr>))}
            {firme.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={5}>Nema firmi. Pokrenite sinhronizaciju.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function PlatformSettings() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("Platforma je u fazi izrade ili prepravke. Molimo vas za strpljenje.");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const token = () => {
    try { return JSON.parse(localStorage.getItem("ponudimi_session") || "null")?.access_token || ""; }
    catch { return ""; }
  };
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/platform/status", { cache: "no-store", headers: { Authorization: `Bearer ${token()}` } });
      if (!response.ok) throw new Error("Nije moguće učitati status platforme.");
      const data = await response.json();
      setEnabled(!!data.maintenance);
      setMessage(data.message || "Platforma je u fazi izrade ili prepravke. Molimo vas za strpljenje.");
    } catch (e) { setError(e instanceof Error ? e.message : "Greška pri učitavanju."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function save(next: boolean) {
    setSaving(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/admin/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ enabled: next, message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Promena statusa nije uspela.");
      setEnabled(!!data.maintenance_enabled);
      setUpdatedAt(data.updated_at || new Date().toISOString());
      setNotice(next ? "Režim održavanja je uključen." : "Platforma je ponovo dostupna korisnicima.");
    } catch (e) { setError(e instanceof Error ? e.message : "Promena statusa nije uspela."); }
    finally { setSaving(false); }
  }
  return (
    <section className="max-w-2xl rounded-2xl bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-xl font-semibold">Režim održavanja platforme</h2>
      <p className="mt-2 text-sm text-muted-foreground">Privremeno zaustavlja korišćenje platforme za sve posetioce. Administratori i dalje mogu da pristupe panelu i rade na izmenama.</p>
      <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-input p-4">
        <div>
          <p className="font-semibold">Trenutni status</p>
          <p className={enabled ? "mt-1 text-sm font-semibold text-destructive" : "mt-1 text-sm font-semibold text-green-700"}>{enabled ? "Održavanje je uključeno" : "Platforma je dostupna"}</p>
        </div>
        <span className={enabled ? "rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive" : "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"}>{enabled ? "ZATVORENA" : "AKTIVNA"}</span>
      </div>
      <label className="mt-5 block text-sm font-medium" htmlFor="maintenance-message">Poruka koja se prikazuje posetiocima</label>
      <textarea id="maintenance-message" className={`${inputCls} mt-2 min-h-28 w-full`} maxLength={300} value={message} onChange={e => setMessage(e.target.value)} />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <h3 className="font-semibold">Uključivanje održavanja</h3>
          <p className="mt-1 text-sm text-muted-foreground">Privremeno onemogućava korišćenje platforme posetiocima i korisnicima.</p>
          <button type="button" disabled={busy || saving || enabled} onClick={() => save(true)} className="mt-4 w-full rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50">{saving && !enabled ? "Čuvanje..." : enabled ? "Održavanje je uključeno" : "Uključi održavanje"}</button>
        </div>
        <div className="rounded-xl border border-green-700/30 bg-green-50 p-4">
          <h3 className="font-semibold">Isključivanje održavanja</h3>
          <p className="mt-1 text-sm text-muted-foreground">Uklanja obaveštenje o održavanju i ponovo omogućava korišćenje platforme.</p>
          <button type="button" disabled={busy || saving || !enabled} onClick={() => save(false)} className="mt-4 w-full rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-50">{saving && enabled ? "Čuvanje..." : !enabled ? "Platforma već radi" : "Isključi održavanje"}</button>
        </div>
      </div>
      <div className="mt-4">
        <button type="button" disabled={busy || saving} onClick={load} className={small}>Osveži status</button>
      </div>
      {busy && <p className="mt-3 text-sm text-muted-foreground">Učitavanje statusa...</p>}
      {notice && <p role="status" className="mt-3 text-sm font-medium text-green-700">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>}
      {updatedAt && <p className="mt-2 text-xs text-muted-foreground">Poslednja izmena: {new Date(updatedAt).toLocaleString("sr-RS")}</p>}
    </section>
  );
}


type AuditRow = {
  id: string; actor_email: string | null; action: string; http_method: string;
  route: string; target_id: string | null; response_status: number;
  details: Record<string, unknown>; created_at: string; total: number;
};

function EvidencijaAktivnosti() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const limit = 100;
  const token = () => {
    try { return JSON.parse(localStorage.getItem("ponudimi_session") || "null")?.access_token || ""; }
    catch { return ""; }
  };
  const query = () => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (actor.trim()) params.set("actor", actor.trim());
    if (action.trim()) params.set("action", action.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  };
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/audit-log?" + query(), { cache: "no-store", headers: { Authorization: `Bearer ${token()}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Evidencija aktivnosti nije dostupna.");
      setRows(data.data || []); setTotal(Number(data.total || 0));
    } catch (e) { setError(e instanceof Error ? e.message : "Greška pri učitavanju evidencije."); }
    finally { setBusy(false); }
  }, [actor, action, from, to, offset]);
  useEffect(() => { load(); }, [load]);
  async function exportCsv() {
    try {
      const response = await fetch("/api/admin/audit-log/export?" + query(), { cache: "no-store", headers: { Authorization: `Bearer ${token()}` } });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Izvoz nije uspeo."); }
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = "ponudimi-evidencija-aktivnosti.csv"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Izvoz nije uspeo."); }
  }
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Evidencija aktivnosti</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pregled izmena i administrativnih radnji na platformi. Lozinke, tokeni i tajni podaci se ne čuvaju.</p>
      </div>
      <div className="grid gap-2 rounded-2xl bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <input className={inputCls} placeholder="Korisnik / e-mail" value={actor} onChange={e => { setActor(e.target.value); setOffset(0); }} />
        <input className={inputCls} placeholder="Vrsta aktivnosti ili putanja" value={action} onChange={e => { setAction(e.target.value); setOffset(0); }} />
        <label className="text-xs text-muted-foreground">Od datuma<input type="date" className={inputCls + " mt-1 w-full"} value={from} onChange={e => { setFrom(e.target.value); setOffset(0); }} /></label>
        <label className="text-xs text-muted-foreground">Do datuma<input type="date" className={inputCls + " mt-1 w-full"} value={to} onChange={e => { setTo(e.target.value); setOffset(0); }} /></label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
          <button type="button" className={small} onClick={() => { setActor(""); setAction(""); setFrom(""); setTo(""); setOffset(0); }}>Očisti filtere</button>
          <button type="button" className={small} onClick={load} disabled={busy}>Osveži</button>
          <button type="button" className={small} onClick={exportCsv}>Izvezi CSV</button>
          <span className="text-sm text-muted-foreground">Ukupno zapisa: {total.toLocaleString("sr-RS")}</span>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-secondary/60 text-muted-foreground"><tr><th className="p-3">Datum i vreme</th><th className="p-3">Korisnik</th><th className="p-3">Aktivnost</th><th className="p-3">Cilj</th><th className="p-3">Rezultat</th></tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-t border-input">
                <td className="whitespace-nowrap p-3">{new Date(row.created_at).toLocaleString("sr-RS")}</td>
                <td className="p-3">{row.actor_email || row.actor_id || "Nepoznat nalog"}</td>
                <td className="p-3"><span className="font-medium">{row.action}</span><span className="block text-xs text-muted-foreground">{row.http_method} · {row.route}</span><span className="mt-1 block max-w-[420px] break-words text-xs text-muted-foreground">Promenjena polja: {Object.keys((row.details?.submitted_values as Record<string, unknown>) || {}).join(", ") || "bez dodatnih podataka"}</span></td>
                <td className="p-3">{row.target_id || "—"}</td>
                <td className="p-3"><span className={row.response_status >= 400 ? "font-semibold text-destructive" : "font-semibold text-green-700"}>{row.response_status}</span></td>
              </tr>
            ))}
            {!busy && rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nema aktivnosti za izabrane filtere.</td></tr>}
            {busy && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Učitavanje evidencije...</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={small} disabled={offset === 0 || busy} onClick={() => setOffset(v => Math.max(0, v - limit))}>Prethodna</button>
        <span className="text-xs text-muted-foreground">{total ? offset + 1 : 0}–{Math.min(offset + limit, total)} od {total}</span>
        <button type="button" className={small} disabled={offset + limit >= total || busy} onClick={() => setOffset(v => v + limit)}>Sledeća</button>
      </div>
    </section>
  );
}
