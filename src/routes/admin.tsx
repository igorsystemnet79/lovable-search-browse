import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
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
const tabs = ["Korisnici", "Ponude", "Zahtevi", "Poruke", "APR firme", "Platforma"] as const;
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
      <AdminSecurityGate email={user.email}>
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
      </AdminSecurityGate>
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


function AdminSecurityGate({ email, children }: { email: string; children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "setup" | "challenge" | "recovery" | "ready" | "error">("loading");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    ponudimi.adminSecurity.status()
      .then((result: any) => { if (active) setStatus(result.elevated ? "ready" : result.enabled ? "challenge" : "setup"); })
      .catch((error: any) => { if (active) { setMessage(error.message || "Provera administratorske zaštite nije uspela."); setStatus("error"); } });
    return () => { active = false; };
  }, []);

  async function beginSetup() {
    setMessage("");
    try {
      const result = await ponudimi.adminSecurity.setup(currentPassword, password, confirmPassword);
      setQr(result.qr);
      setManualKey(result.manual_key);
      setCode("");
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setStatus("setup");
      setMessage("Skeniraj QR kod aplikacijom Google Authenticator, pa unesi šestocifreni kod koji aplikacija prikaže.");
    } catch (error: any) { setMessage(error.message || "Podešavanje nije uspelo."); }
  }
  async function verifySetup() {
    setMessage("");
    try {
      const result = await ponudimi.adminSecurity.verifySetup(code);
      setRecoveryCodes(result.recovery_codes || []);
      setStatus("recovery");
    } catch (error: any) { setMessage(error.message || "Kod nije prihvaćen."); }
  }
  async function verifyLogin() {
    setMessage("");
    try {
      const result = await ponudimi.adminSecurity.challenge(email, password, code);
      await ponudimi.auth.setSession(result.session);
      setStatus("ready");
    } catch (error: any) { setMessage(error.message || "Dodatna potvrda nije uspela."); }
  }

  if (status === "loading") return <p className="text-sm text-muted-foreground">Proveravam dodatnu zaštitu administratora…</p>;
  if (status === "ready") return <>{children}</>;
  if (status === "error") return <div className="max-w-xl rounded-2xl border border-destructive/30 bg-surface p-5"><p className="font-semibold">Administratorska zaštita trenutno nije dostupna.</p><p className="mt-2 text-sm text-muted-foreground">{message}</p><button className={small + " mt-4"} onClick={() => window.location.reload()}>Pokušaj ponovo</button></div>;

  if (status === "recovery") return (
    <section className="max-w-xl rounded-2xl border border-input bg-surface p-5">
      <h2 className="text-xl font-semibold">Sačuvaj rezervne kodove</h2>
      <p className="mt-2 text-sm text-muted-foreground">Svaki kod može da se iskoristi samo jednom. Sačuvaj ih na bezbednom mestu van ovog telefona. Neće ponovo biti prikazani.</p>
      <div className="my-4 grid grid-cols-2 gap-2 rounded-xl bg-background p-3 font-mono text-sm">{recoveryCodes.map((value) => <span key={value}>{value}</span>)}</div>
      <button className={small} onClick={() => { setRecoveryCodes([]); setPassword(""); setCurrentPassword(""); setConfirmPassword(""); setCode(""); setMessage("Authenticator je aktiviran. Sačekaj da se kod u aplikaciji promeni, pa potvrdi pristup zasebnom administratorskom lozinkom i novim kodom."); setStatus("challenge"); }}>Sačuvao sam kodove — nastavi</button>
    </section>
  );

  return (
    <section className="max-w-xl rounded-2xl border border-input bg-surface p-5">
      <h2 className="text-xl font-semibold">{status === "setup" ? "Google Authenticator zaštita" : "Potvrda administratorskog pristupa"}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{status === "setup" ? "Postavi posebnu administratorsku lozinku, različitu od lozinke običnog naloga, a zatim poveži Google Authenticator. Ova aktivacija ne menja tvoju postojeću Facebook prijavu niti druge unose u Authenticator aplikaciji." : "Unesi administratorsku lozinku i šestocifreni kod iz Google Authenticator aplikacije. Možeš uneti i rezervni kod."}</p>
      {status === "setup" && qr && <div className="my-4 flex flex-col items-center gap-3"><img src={qr} alt="QR kod za PonudiMi Google Authenticator" className="h-56 w-56 rounded-xl bg-white p-2" /><p className="break-all text-center text-xs text-muted-foreground">Ručni ključ: {manualKey}</p></div>}
      {status === "setup" && !qr && <div className="mt-4 space-y-3"><input className={inputCls + " w-full"} type="password" autoComplete="current-password" placeholder="Trenutna lozinka naloga" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /><input className={inputCls + " w-full"} type="password" autoComplete="new-password" placeholder="Nova zasebna administratorska lozinka (min. 12 karaktera)" value={password} onChange={(e) => setPassword(e.target.value)} /><input className={inputCls + " w-full"} type="password" autoComplete="new-password" placeholder="Ponovi administratorsku lozinku" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>}
      {status === "setup" && qr && <input className={inputCls + " mt-4 w-full"} inputMode="numeric" autoComplete="one-time-code" placeholder="Šestocifreni kod iz Authenticatora" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />}
      {status === "challenge" && <><input className={inputCls + " mt-4 w-full"} type="password" autoComplete="current-password" placeholder="Zasebna administratorska lozinka" value={password} onChange={(e) => setPassword(e.target.value)} /><input className={inputCls + " mt-3 w-full"} autoComplete="one-time-code" placeholder="Authenticator ili rezervni kod" value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20))} /></>}
      {message && <p className="mt-3 text-sm text-destructive">{message}</p>}
      <button className={small + " mt-4"} disabled={status === "setup" ? (qr ? code.length !== 6 : !currentPassword || password.length < 12 || password !== confirmPassword) : !password || !code} onClick={status === "setup" ? (qr ? verifySetup : beginSetup) : verifyLogin}>{status === "setup" ? (qr ? "Potvrdi kod i aktiviraj" : "Napravi QR kod") : "Potvrdi i otvori administraciju"}</button>
    </section>
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
