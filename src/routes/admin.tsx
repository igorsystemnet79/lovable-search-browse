import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { API_ORIGIN, ponudimi } from "@/integrations/standalone/client";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { obrisiKorisnika, sinhronizujApr, dodajAdminFotografije, obrisiAdminFotografiju, posaljiPredlogIzmene, ucitajPredlogeModeratora, ucitajAdminPredloge, odluciOPredlogu } from "@/lib/admin.functions";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { inputCls } from "@/components/auth-shell";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/integrations/standalone/types";
import { obradiPrijavu, ucitajPrijaveOglasa, type PrijavaOglasa } from "@/lib/reports";

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
const tabs = ["Korisnici", "Ponude", "Zahtevi", "Prijave", "Odobrenja", "Poruke", "APR firme", "ChatGPT"] as const;
const small = "min-h-10 rounded-full border border-input px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50";
const danger = "min-h-10 rounded-full bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground hover:opacity-90";

function AdminPage() {
  const { user, isAdmin, isModerator, checked } = useIsAdmin();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Korisnici");
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => { if (!isAdmin) return; let active = true; ucitajAdminPredloge().then((items) => { if (active) setPendingCount((items as Predlog[]).filter((p) => p.status === "na_cekanju").length); }).catch(() => {}); return () => { active = false; }; }, [isAdmin, tab]);

  let body;
  if (!checked) body = <p className="text-muted-foreground">Učitavanje...</p>;
  else if (!user) body = <p>Morate se <Link to="/prijava" className="font-semibold text-brand hover:underline">prijaviti</Link>.</p>;
  else if (!isAdmin && !isModerator) body = <p>Nemate pristup administratorskom panelu.</p>;
  else
    body = (
      <>
        {isAdmin ? (
          <>
            <div className="mb-6 flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`min-h-10 rounded-full px-4 py-2 text-sm font-medium ${tab === t ? "bg-brand text-brand-foreground" : "border border-input hover:bg-secondary"}`}>{t === "Odobrenja" && pendingCount > 0 ? `Odobrenja (${pendingCount})` : t}</button>
              ))}
            </div>
            {tab === "Korisnici" && <Korisnici selfId={user.id} />}
            {tab === "Ponude" && <Oglasi tabela="ponude" />}
            {tab === "Zahtevi" && <Oglasi tabela="zahtevi" />}
            {tab === "Prijave" && <Prijave />}
            {tab === "Odobrenja" && <PredloziZaOdobrenje />}
            {tab === "Poruke" && <Poruke />}
            {tab === "APR firme" && <Apr />}
            {tab === "ChatGPT" && <AdminChatGPT />}
          </>
        ) : <ModeratorWorkspace />}
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


function Prijave() {
  const [rows, setRows] = useState<PrijavaOglasa[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await ucitajPrijaveOglasa());
      setMsg("");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Prijave nije moguće učitati.");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(item: PrijavaOglasa, status: "pregledano" | "odbijeno") {
    const napomena = prompt(status === "pregledano" ? "Napomena administratora (opciono):" : "Razlog odbijanja (opciono):");
    if (napomena === null) return;
    setBusy(item.id);
    setMsg("");
    try {
      await obradiPrijavu(item.id, status, napomena);
      setMsg(status === "pregledano" ? "Prijava je označena kao pregledana." : "Prijava je odbijena.");
      await load();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Obrada prijave nije uspela.");
    } finally {
      setBusy(null);
    }
  }

  const reasonLabels: Record<string, string> = {
    sumnja_na_prevaru: "Sumnja na prevaru",
    netacni_podaci: "Netačni podaci",
    neispravan_kontakt: "Neispravan kontakt",
    neprimeren_sadrzaj: "Neprimeren sadržaj",
    dupliran_oglas: "Dupliran oglas",
    ostalo: "Ostalo",
  };
  const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLocaleLowerCase("sr");
  const terms = normalized(filter).trim().split(/\s+/).filter(Boolean);
  const visible = rows.filter((item) => {
    const searchable = normalized([
      item.oglas_naslov, item.oglas_lokacija, item.vlasnik_email, item.prijavio_email,
      item.razlog, item.detalji, item.status, item.oglas_id,
    ].filter(Boolean).join(" "));
    return terms.every((term) => searchable.includes(term));
  });
  const pending = rows.filter((item) => item.status === "na_cekanju").length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div><h2 className="font-semibold">Prijave oglasa</h2><p className="text-sm text-muted-foreground">Na čekanju: {pending} · Ukupno: {rows.length}</p></div>
        <Input className={inputCls + " min-w-0 w-full sm:max-w-sm"} value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Pretraži naslov, lokaciju, korisnika..." />
        <button type="button" className={small} onClick={load}>Osveži</button>
      </div>
      {msg && <p role="status" className="text-sm text-brand">{msg}</p>}
      {visible.map((item) => (
        <article key={item.id} className="rounded-2xl bg-surface p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{item.oglas_naslov || "Oglas više nije dostupan"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.tabela === "ponude" ? "Ponuda" : "Zahtev"} · {item.oglas_lokacija || "Lokacija nije dostupna"} · {new Date(item.created_at).toLocaleString("sr-RS")}</p>
            </div>
            <span className={item.status === "na_cekanju" ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800" : "rounded-full bg-secondary px-3 py-1 text-xs font-semibold"}>{item.status === "na_cekanju" ? "Čeka pregled" : item.status === "pregledano" ? "Pregledano" : "Odbijeno"}</span>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Razlog: </span><b>{reasonLabels[item.razlog] || item.razlog}</b></p>
            <p><span className="text-muted-foreground">Vlasnik oglasa: </span>{item.vlasnik_email || "Nedostupan podatak"}</p>
            <p><span className="text-muted-foreground">Prijavio: </span>{item.prijavio_email || (item.prijavio_id ? "Registrovani korisnik" : "Anonimna prijava")}</p>
            <p className="break-all text-xs text-muted-foreground">ID oglasa: {item.oglas_id}</p>
          </div>
          {item.detalji && <p className="mt-3 whitespace-pre-wrap rounded-xl border border-input p-3 text-sm">{item.detalji}</p>}
          {item.admin_napomena && <p className="mt-2 text-sm text-muted-foreground">Napomena administratora: {item.admin_napomena}</p>}
          {item.status === "na_cekanju" && <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={small} disabled={busy === item.id} onClick={() => decide(item, "pregledano")}>Označi kao pregledano</button><button type="button" className={danger} disabled={busy === item.id} onClick={() => decide(item, "odbijeno")}>Odbij prijavu</button></div>}
        </article>
      ))}
      {!visible.length && <p className="rounded-2xl bg-surface p-5 text-sm text-muted-foreground">{rows.length ? "Nema prijava koje odgovaraju pretrazi." : "Još nema prijava oglasa."}</p>}
    </section>
  );
}

function AdminChatGPT() {
  type Message = { role: "user" | "assistant"; content: string };
  type Usage = { input_tokens: number; output_tokens: number; cached_input_tokens: number; cost_usd: number | string };
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [conversationUsage, setConversationUsage] = useState<Usage>({ input_tokens: 0, output_tokens: 0, cached_input_tokens: 0, cost_usd: 0 });
  const [totalUsage, setTotalUsage] = useState<Usage>({ input_tokens: 0, output_tokens: 0, cached_input_tokens: 0, cost_usd: 0 });

  const loadUsage = useCallback(async (id: string) => {
    const session = JSON.parse(window.localStorage.getItem("ponudimi_session") || "null");
    const response = await fetch(`${API_ORIGIN}/api/admin/chatgpt/usage?conversation_id=${encodeURIComponent(id)}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (!response.ok) throw new Error("Potrošnja nije mogla da se učita.");
    const data = await response.json();
    setConversationUsage(data.conversation);
    setTotalUsage(data.all_time);
  }, []);

  useEffect(() => {
    let active = true;
    try {
      const session = JSON.parse(window.localStorage.getItem("ponudimi_session") || "null");
      fetch(`${API_ORIGIN}/api/admin/chatgpt/status`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      }).then(async (response) => {
        if (!response.ok) throw new Error("Status asistenta nije dostupan.");
        const data = await response.json();
        if (active) {
          setConfigured(Boolean(data.configured));
          if (data.configured) await loadUsage(conversationId);
        }
      }).catch(() => { if (active) setConfigured(false); });
    } catch { setConfigured(false); }
    return () => { active = false; };
  }, [conversationId, loadUsage]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || busy || !configured) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setPrompt("");
    setBusy(true);
    setError("");
    try {
      const session = JSON.parse(window.localStorage.getItem("ponudimi_session") || "null");
      const response = await fetch(`${API_ORIGIN}/api/admin/chatgpt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ messages: next.slice(-12), conversation_id: conversationId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Poruka nije poslata.");
      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
      await loadUsage(conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška u komunikaciji sa asistentom.");
    } finally {
      setBusy(false);
    }
  }

  function newConversation() {
    setMessages([]);
    setError("");
    const id = crypto.randomUUID();
    setConversationId(id);
    setConversationUsage({ input_tokens: 0, output_tokens: 0, cached_input_tokens: 0, cost_usd: 0 });
  }
  const money = (value: number | string) => `${Number(value || 0).toFixed(6)}`;
  const tokens = (value: number | string) => Number(value || 0).toLocaleString("sr-RS");

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-2xl bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand"><span className="text-lg font-bold">GPT</span></div>
          <div><h2 className="font-semibold">ChatGPT — pomoć za administraciju</h2><p className="text-sm text-muted-foreground">Privatni razgovor dostupan samo administratorima.</p></div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Može da proveri stanje API-ja i baze, prikaže statistiku i pretraži postojeće oglase i korisnike. Trenutno radi u režimu bezbedne provere (bez izmena podataka).</p>
      </div>
      {configured === false && (
        <div className="rounded-2xl border border-input p-4 text-sm">
          <p className="font-semibold">Povezivanje još nije podešeno.</p>
          <p className="mt-1 text-muted-foreground">Na Render API servisu potrebno je dodati tajnu promenljivu OPENAI_API_KEY. Po želji se može podesiti i OPENAI_MODEL. Ključ se čuva isključivo na serveru i nikada se ne šalje pregledaču.</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-input bg-surface p-4">
          <p className="text-xs text-muted-foreground">Potrošnja ovog razgovora</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{money(conversationUsage.cost_usd)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Ulaz: {tokens(conversationUsage.input_tokens)} · Izlaz: {tokens(conversationUsage.output_tokens)} tokena</p>
        </div>
        <div className="rounded-2xl border border-input bg-surface p-4">
          <p className="text-xs text-muted-foreground">Ukupna potrošnja svih razgovora</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{money(totalUsage.cost_usd)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Ulaz: {tokens(totalUsage.input_tokens)} · Izlaz: {tokens(totalUsage.output_tokens)} tokena</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-4 py-3 text-xs text-muted-foreground">
        <span>Keširani ulazni tokeni: {tokens(totalUsage.cached_input_tokens)}</span>
        <button type="button" className={small} onClick={() => loadUsage(conversationId)}>Osveži potrošnju</button>
      </div>
      <div className="min-h-64 space-y-3 rounded-2xl bg-surface p-4 shadow-card">
        {!messages.length && <p className="py-12 text-center text-sm text-muted-foreground">Započni razgovor. Na primer: „Pomozi mi da proverim zašto dodavanje oglasa ne radi.“</p>}
        {messages.map((message, index) => (
          <div key={index} className={`max-w-[90%] whitespace-pre-wrap rounded-2xl p-3 text-sm ${message.role === "user" ? "ml-auto bg-brand text-brand-foreground" : "mr-auto border border-input bg-background"}`}>
            <p className="mb-1 text-xs font-semibold opacity-70">{message.role === "user" ? "Ti" : "ChatGPT"}</p>
            {message.content}
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">ChatGPT priprema odgovor...</p>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={send} className="space-y-2">
        <textarea className={inputCls + " min-h-24 w-full"} placeholder="Napiši pitanje ili opiši problem..." value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={6000} disabled={!configured || busy} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Iznosi su obračunati po cenama modela na serveru. Ne šalji lozinke, API ključeve ni podatke o platnim karticama.</p>
          <div className="flex gap-2">
            <button type="button" className={small} onClick={newConversation}>Novi razgovor</button>
            <button type="submit" className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50" disabled={!configured || busy || !prompt.trim()}>{busy ? "Šaljem..." : "Pošalji"}</button>
          </div>
        </div>
      </form>
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
    const ucitajSve = async (tabela: "profiles" | "user_roles") => {
      const svi: any[] = [];
      for (let offset = 0; ; offset += 500) {
        let query = ponudimi.from(tabela).select("*");
        if (tabela === "profiles") query = query.order("created_at", { ascending: false });
        const page = await query.range(offset, offset + 499);
        if (page.error) throw new Error(page.error.message || "Učitavanje nije uspelo.");
        const redovi = page.data ?? [];
        svi.push(...redovi);
        if (redovi.length < 500) break;
      }
      return svi;
    };
    try {
      const [p, r] = await Promise.all([ucitajSve("profiles"), ucitajSve("user_roles")]);
      setProfili(p as Profil[]);
      const m: Record<string, Uloga[]> = {};
      for (const x of r) (m[x.user_id] ??= []).push(x.role);
      setUloge(m);
    } catch {
      setMsg("Učitavanje korisnika nije uspelo. Osvežite stranicu i pokušajte ponovo.");
    }
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

  const [prikaz, setPrikaz] = useState<"fizicka" | "firme">("fizicka");
  const normalizujPretragu = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("sr");
  const pojmoviPretrage = normalizujPretragu(filter).trim().split(/\s+/).filter(Boolean);
  const collator = new Intl.Collator("sr", { sensitivity: "base", numeric: true });
  const filtrirani = profili.filter((p) => {
    if (prikaz === "firme" ? p.tip_lica !== "pravno" : p.tip_lica === "pravno") return false;
    if (!pojmoviPretrage.length) return true;
    const pretraziviTekst = normalizujPretragu(
      [p.ime, p.email, p.naziv_firme, p.pib, p.telefon, p.grad, p.adresa]
        .filter(Boolean)
        .join(" ")
    );
    // Svaka uneta reč mora da postoji u podacima, bez obzira na redosled.
    return pojmoviPretrage.every((pojam) => pretraziviTekst.includes(pojam));
  });
  const lista = [...filtrirani].sort((a, b) => {
    if (prikaz === "firme") return collator.compare((a.naziv_firme || "").trim(), (b.naziv_firme || "").trim());
    const deloviA = (a.ime || "").trim().split(/\s+/).filter(Boolean);
    const deloviB = (b.ime || "").trim().split(/\s+/).filter(Boolean);
    // Sve reči posle imena tretiramo kao prezime, uključujući složena prezimena.
    const prezimeA = deloviA.length > 1 ? deloviA.slice(1).join(" ") : (deloviA[0] || a.email || "");
    const prezimeB = deloviB.length > 1 ? deloviB.slice(1).join(" ") : (deloviB[0] || b.email || "");
    const poPrezimenu = collator.compare(prezimeA, prezimeB);
    const poImenu = collator.compare(deloviA[0] || "", deloviB[0] || "");
    return poPrezimenu || poImenu || collator.compare(a.email || "", b.email || "");
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={prikaz === "fizicka" ? `${small} bg-brand text-brand-foreground` : small} onClick={() => { setPrikaz("fizicka"); setFilter(""); setEdit(null); }}>Fizička lica</button>
          <button type="button" className={prikaz === "firme" ? `${small} bg-brand text-brand-foreground` : small} onClick={() => { setPrikaz("firme"); setFilter(""); setEdit(null); }}>Registrovane firme</button>
        </div>
        <Input className={`${inputCls} min-w-0 w-full sm:max-w-sm`} placeholder={prikaz === "firme" ? "Pretraži naziv firme, PIB..." : "Pretraži ime ili prezime..."} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="whitespace-nowrap text-sm text-muted-foreground">{prikaz === "firme" ? "Registrovanih firmi" : "Registrovanih korisnika"}: {filtrirani.length}</span>
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
                    {p.email_confirmed_at && p.telefon_verifikovan_at && <span className="font-bold text-green-700">✓ VERIFIKOVAN KORISNIK</span>}
                    {p.duplikat_sumnja && <span className="font-semibold text-amber-700">PROVERITI MOGUĆI DUPLIKAT</span>}
                    {p.blokiran && <span className="font-semibold text-destructive">BLOKIRAN</span>}
                  </p>
                  <p className="mt-1 text-xs">Uloge: {r.join(", ") || "nema"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={small} onClick={() => setEdit(p)}>Izmeni</button>
                  <button className={small} disabled={p.id === selfId} onClick={() => toggleUloga(p.id, "admin")}>{r.includes("admin") ? "Ukini admina" : "Daj admina"}</button>
                  <button className={small} onClick={() => toggleUloga(p.id, "moderator")}>{r.includes("moderator") ? "Ukini moderatora" : "Daj moderatora"}</button>
                  <button className={small} disabled={p.id === selfId} onClick={() => update(p.id, { blokiran: !p.blokiran })}>{p.blokiran ? "Vrati sve privilegije" : "Ukini sve privilegije"}</button>
                  {p.tip_lica === "pravno" && <button className={small} onClick={() => update(p.id, { firma_verifikovana: !p.firma_verifikovana })}>{p.firma_verifikovana ? "Poništi verifikaciju" : "Verifikuj firmu"}</button>}
                  {p.id !== selfId && <button className={danger} onClick={() => obrisi(p)}>Obriši</button>}
                </div>
              </div>
              {edit?.id === p.id && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {(["ime", "telefon", "grad", "adresa", "naziv_firme", "pib"] as const).map((k) => (
                    <Input key={k} className={inputCls} placeholder={k} value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value || null })} />
                  ))}
                  <select className={inputCls} value={edit.tip_lica} onChange={(e) => setEdit({ ...edit, tip_lica: e.target.value })}>
                    <option value="fizicko">Fizičko lice</option>
                    <option value="pravno">Pravno lice</option>
                  </select>
                  <div className="flex gap-2">
                    <button className={small} onClick={() => { const { id, ime, telefon, grad, adresa, naziv_firme, pib, tip_lica } = edit; update(id, { ime, telefon, grad, adresa, naziv_firme, pib, tip_lica }); setEdit(null); }}>Sačuvaj</button>
                    <button className={small} onClick={() => setEdit(null)}>Otkaži</button>
                  </div>
                </div>
              )}            </div>          );
        })}
        {lista.length === 0 && <p className="rounded-2xl bg-surface p-4 text-sm text-muted-foreground">{prikaz === "firme" ? "Nema registrovanih firmi." : "Nema registrovanih fizičkih lica."}</p>}
      </div>
    </div>
  );
}

type Oglas = { id: string; user_id: string; naslov: string; opis: string | null; kategorija: string; lokacija: string; kontakt_ime: string | null; telefon: string | null; created_at: string; cena?: number | null; budzet?: number | null; valuta?: string };
type AdminImage = { id: string; storage_path: string | null; external_url: string | null; pozicija: number };

function Oglasi({ tabela }: { tabela: "ponude" | "zahtevi" }) {
  const [rows, setRows] = useState<Oglas[]>([]);
  const [edit, setEdit] = useState<Oglas | null>(null);
  const [msg, setMsg] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, AdminImage[]>>({});
  const [imageBusy, setImageBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const polje = tabela === "ponude" ? "cena" : "budzet";
  const imageColumn = tabela === "ponude" ? "ponuda_id" : "zahtev_id";
  const load = useCallback(async () => {
    const { data, error } = await ponudimi.from(tabela).select("*").includePausedListings().order("created_at", { ascending: false });
    if (error) {
      setMsg("Učitavanje nije uspelo. Osvežite stranicu i pokušajte ponovo.");
      return;
    }
    setRows((data ?? []) as Oglas[]);
  }, [tabela]);
  useEffect(() => { load(); }, [load]);

  const normalizujPretragu = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("sr");
  const pojmoviPretrage = normalizujPretragu(filter).trim().split(/\s+/).filter(Boolean);
  const filtriraniRows = rows.filter((o) => {
    if (!pojmoviPretrage.length) return true;
    const pretraziviTekst = normalizujPretragu(
      [o.naslov, o.opis, o.kategorija, o.lokacija, o.kontakt_ime, o.telefon, o.user_id, o.id, o[polje], o.valuta]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
    );
    return pojmoviPretrage.every((pojam) => pretraziviTekst.includes(pojam));
  });

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
  async function toggleImages(o: Oglas) {
    if (expandedId === o.id) { setExpandedId(null); return; }
    setExpandedId(o.id);
    const { data, error } = await ponudimi.from("slike_oglasa").select("*").eq(imageColumn, o.id).order("pozicija");
    if (error) { setMsg("Fotografije nije moguće učitati."); return; }
    setImages((current) => ({ ...current, [o.id]: (data ?? []) as AdminImage[] }));
  }
  async function uploadImages(o: Oglas, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setImageBusy(true);
    setMsg("");
    try {
      await dodajAdminFotografije({ kind: tabela, listingId: o.id, files });
      const { data } = await ponudimi.from("slike_oglasa").select("*").eq(imageColumn, o.id).order("pozicija");
      setImages((current) => ({ ...current, [o.id]: (data ?? []) as AdminImage[] }));
      setMsg("Fotografije su dodate.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Dodavanje fotografija nije uspelo.");
    } finally { setImageBusy(false); }
  }
  async function removeImage(o: Oglas, image: AdminImage) {
    if (!confirm("Obrisati ovu fotografiju iz oglasa?")) return;
    setImageBusy(true);
    try {
      await obrisiAdminFotografiju(image.id);
      setImages((current) => ({ ...current, [o.id]: (current[o.id] ?? []).filter((item) => item.id !== image.id) }));
      setMsg("Fotografija je obrisana.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Brisanje fotografije nije uspelo.");
    } finally { setImageBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-md">
          <Input
            className={inputCls + " w-full pr-10"}
            placeholder={tabela === "ponude" ? "Pretraži ponude: naslov, opis, kategorija, lokacija..." : "Pretraži zahteve: naslov, opis, kategorija, lokacija..."}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label={tabela === "ponude" ? "Pretraga ponuda" : "Pretraga zahteva"}
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              aria-label="Obriši pretragu"
              title="Obriši pretragu"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Prikazano: {filtriraniRows.length} / {rows.length}
          {msg && <span className="text-brand"> · {msg}</span>}
        </p>
      </div>
      {filtriraniRows.map((o) => (
        <div key={o.id} className="rounded-2xl bg-surface p-4 shadow-card">
          {edit?.id === o.id ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input className={inputCls} value={edit.naslov} onChange={(e) => setEdit({ ...edit, naslov: e.target.value })} />
              <Input className={inputCls} value={edit.lokacija} onChange={(e) => setEdit({ ...edit, lokacija: e.target.value })} />
              <Input className={inputCls} placeholder="Kontakt" value={edit.kontakt_ime ?? ""} onChange={(e) => setEdit({ ...edit, kontakt_ime: e.target.value })} />
              <Input className={inputCls} placeholder="Telefon" value={edit.telefon ?? ""} onChange={(e) => setEdit({ ...edit, telefon: e.target.value })} />
              <Input className={inputCls} type="number" min={0} placeholder={tabela === "ponude" ? "Cena" : "Budžet"} value={edit[polje] ?? ""} onChange={(e) => setEdit({ ...edit, [polje]: e.target.value === "" ? null : Number(e.target.value) })} />
              <textarea className={inputCls + " sm:col-span-2"} rows={3} value={edit.opis ?? ""} onChange={(e) => setEdit({ ...edit, opis: e.target.value })} />
              <div className="flex gap-2"><button className={small} onClick={sacuvaj}>Sačuvaj</button><button className={small} onClick={() => setEdit(null)}>Otkaži</button></div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold">{o.naslov}</p>
                <p className="text-muted-foreground">{o.lokacija} · {o.kontakt_ime ?? "—"} · {o.telefon ?? "—"} · {o[polje] ?? "po dogovoru"}</p>
                <p className="mt-1 text-xs text-muted-foreground">ID vlasnika: {o.user_id}</p>
              </div>
              <div className="flex gap-2"><button className={small} onClick={() => setEdit(o)}>Izmeni</button><button className={danger} onClick={() => obrisi(o.id)}>Obriši</button></div>
            </div>
          )}
          <div className="mt-3 border-t border-input pt-3">
            <button className={small} onClick={() => toggleImages(o)}>{expandedId === o.id ? "Zatvori fotografije" : "Upravljaj fotografijama"}</button>
            {expandedId === o.id && (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">Fotografije: {images[o.id]?.length ?? 0} / 7</p>
                <div className="flex flex-wrap gap-3">
                  {(images[o.id] ?? []).map((image) => (
                    <div key={image.id} className="w-28">
                      <img src={image.external_url || ponudimi.storage.from("listing-images").getPublicUrl((image.storage_path || "").replace("/uploads/", "")).data.publicUrl} alt="Fotografija oglasa" className="h-24 w-28 rounded-lg border border-input object-cover" />
                      <button className={danger + " mt-2 w-full"} disabled={imageBusy} onClick={() => removeImage(o, image)}>Obriši sliku</button>
                    </div>
                  ))}
                  {(images[o.id]?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Oglas trenutno nema fotografija.</p>}
                </div>
                <label className="inline-flex cursor-pointer items-center rounded-full bg-highlight px-4 py-2 text-sm font-semibold text-highlight-foreground hover:opacity-90">
                  {imageBusy ? "Sačekajte..." : "Dodaj fotografije"}
                  <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={imageBusy || (images[o.id]?.length ?? 0) >= 7} onChange={(event) => uploadImages(o, event)} />
                </label>
                <p className="text-xs text-muted-foreground">JPG, PNG ili WebP. Najviše 7 fotografija po oglasu.</p>
              </div>
            )}
          </div>
        </div>
      ))}
      {filtriraniRows.length === 0 && (
        <p className="rounded-2xl bg-surface p-5 text-sm text-muted-foreground">
          {rows.length === 0 ? "Nema objavljenih stavki." : "Nema rezultata za uneti pojam. Pokušajte sa drugim izrazom."}
        </p>
      )}
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
        <Input className={`${inputCls} max-w-xs`} placeholder="Naziv, PIB ili matični broj" value={q} onChange={(e) => setQ(e.target.value)} />
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

type Predlog = { id: string; tabela: "ponude" | "zahtevi"; oglas_id: string; moderator_id: string; moderator_email?: string; moderator_ime?: string; trenutni_podaci: Record<string, unknown>; predlozeni_podaci: Record<string, unknown>; status: "na_cekanju" | "odobreno" | "odbijeno"; admin_napomena?: string | null; created_at: string };

function ModeratorWorkspace() {
 const [kind,setKind]=useState<"ponude"|"zahtevi">("ponude");
 const [rows,setRows]=useState<Oglas[]>([]); const [editing,setEditing]=useState<Oglas|null>(null);
 const [msg,setMsg]=useState(""); const [busy,setBusy]=useState(false); const [filter,setFilter]=useState(""); const [proposals,setProposals]=useState<Predlog[]>([]);
 const load=useCallback(async()=>{const result=await ponudimi.from(kind).select("*").order("created_at",{ascending:false}).limit(200);setRows((result.data??[]) as Oglas[]);try{setProposals(await ucitajPredlogeModeratora() as Predlog[]);}catch{}},[kind]);
 useEffect(()=>{load();},[load]);
 const q=filter.toLowerCase(); const visible=rows.filter(o=>!q||[o.naslov,o.kategorija,o.lokacija,o.user_id].some(v=>String(v??"").toLowerCase().includes(q)));
 async function submit(){if(!editing)return;const amount=kind==="ponude"?"cena":"budzet";const payload={naslov:editing.naslov,opis:editing.opis,kategorija:editing.kategorija,lokacija:editing.lokacija,[amount]:editing[amount]??null,valuta:editing.valuta||"EUR",kontakt_ime:editing.kontakt_ime,telefon:editing.telefon};setBusy(true);setMsg("");try{await posaljiPredlogIzmene({tabela:kind,oglas_id:editing.id,predlozeni_podaci:payload});setMsg("Predlog je poslat administratoru. Oglas nije promenjen.");setEditing(null);await load();}catch(e){setMsg(e instanceof Error?e.message:"Slanje predloga nije uspelo.");}finally{setBusy(false);}}
 return <div className="space-y-4">
  <div className="flex flex-wrap items-center gap-2"><button className={kind==="ponude"?small:"rounded-full border border-input px-3 py-1 text-xs"} onClick={()=>{setKind("ponude");setEditing(null);}}>Ponude</button><button className={kind==="zahtevi"?small:"rounded-full border border-input px-3 py-1 text-xs"} onClick={()=>{setKind("zahtevi");setEditing(null);}}>Zahtevi</button><Input className={inputCls+" max-w-sm"} placeholder="Pretraga oglasa ili ID korisnika" value={filter} onChange={e=>setFilter(e.target.value)}/></div>
  <p className="text-sm text-muted-foreground">Pronađeno oglasa: {visible.length} · Tvoji predlozi: {proposals.length}</p>{msg&&<p className="rounded-xl bg-surface p-3 text-sm">{msg}</p>}
  {editing&&<div className="rounded-2xl border border-brand/30 bg-surface p-4 shadow-card"><h2 className="mb-3 font-semibold">Predlog izmene: {editing.naslov}</h2><p className="mb-3 text-xs text-muted-foreground">Izmena neće biti objavljena dok je administrator ne odobri.</p>
   <div className="grid gap-2 sm:grid-cols-2"><Input className={inputCls} placeholder="Naslov" value={editing.naslov} onChange={e=>setEditing({...editing,naslov:e.target.value})}/><Input className={inputCls} placeholder="Kategorija" value={editing.kategorija} onChange={e=>setEditing({...editing,kategorija:e.target.value})}/><Input className={inputCls} placeholder="Lokacija" value={editing.lokacija} onChange={e=>setEditing({...editing,lokacija:e.target.value})}/><Input className={inputCls} placeholder="Kontakt osoba" value={editing.kontakt_ime??""} onChange={e=>setEditing({...editing,kontakt_ime:e.target.value})}/><Input className={inputCls} placeholder="Telefon" value={editing.telefon??""} onChange={e=>setEditing({...editing,telefon:e.target.value})}/><Input className={inputCls} type="number" min="0" placeholder={kind==="ponude"?"Cena":"Budžet"} value={editing[kind==="ponude"?"cena":"budzet"]??""} onChange={e=>setEditing({...editing,[kind==="ponude"?"cena":"budzet"]:e.target.value===""?null:Number(e.target.value)})}/><select className={inputCls} value={editing.valuta||"EUR"} onChange={e=>setEditing({...editing,valuta:e.target.value})}><option value="EUR">EUR</option><option value="RSD">RSD</option></select><textarea className={inputCls+" sm:col-span-2"} rows={4} placeholder="Opis" value={editing.opis??""} onChange={e=>setEditing({...editing,opis:e.target.value})}/></div>
   <div className="mt-3 flex gap-2"><button className={small} disabled={busy} onClick={submit}>{busy?"Šaljem...":"Pošalji administratoru na odobrenje"}</button><button className={small} onClick={()=>setEditing(null)}>Otkaži</button></div></div>}
  <div className="space-y-2">{visible.map(o=><div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-card"><div className="text-sm"><p className="font-semibold">{o.naslov}</p><p className="text-muted-foreground">{o.kategorija} · {o.lokacija} · {kind==="ponude"?(o.cena??"po dogovoru"):(o.budzet??"po dogovoru")} {o.valuta||"EUR"}</p><p className="text-xs text-muted-foreground">Vlasnik naloga: {o.user_id}</p></div><button className={small} onClick={()=>setEditing(o)}>Predloži izmenu</button></div>)}{!visible.length&&<p className="text-sm text-muted-foreground">Nema oglasa za prikaz.</p>}</div>
  <div className="border-t border-input pt-4"><h2 className="mb-3 font-semibold">Moji poslati predlozi</h2>{proposals.map(p=><div key={p.id} className="mb-2 rounded-xl bg-surface p-3 text-sm"><p className="font-medium">{p.tabela==="ponude"?"Ponuda":"Zahtev"} · {String(p.predlozeni_podaci?.naslov||p.oglas_id)}</p><p className="text-muted-foreground">Status: {p.status==="na_cekanju"?"Čeka administratora":p.status==="odobreno"?"Odobreno":"Odbijeno"} · {new Date(p.created_at).toLocaleString("sr-RS")}</p>{p.admin_napomena&&<p>Napomena: {p.admin_napomena}</p>}</div>)}</div>
 </div>;
}

function PredloziZaOdobrenje() {
 const [rows,setRows]=useState<Predlog[]>([]); const [msg,setMsg]=useState(""); const [busy,setBusy]=useState<string|null>(null);
 const load=useCallback(async()=>{try{setRows(await ucitajAdminPredloge() as Predlog[]);}catch(e){setMsg(e instanceof Error?e.message:"Predlozi nisu učitani.");}},[]);useEffect(()=>{load();},[load]);
 async function decide(p:Predlog,decision:"odobreno"|"odbijeno"){const note=decision==="odbijeno"?(prompt("Razlog odbijanja (opciono):")||""):"";setBusy(p.id);setMsg("");try{await odluciOPredlogu(p.id,decision,note);setMsg(decision==="odobreno"?"Izmena je odobrena i primenjena na oglas.":"Predlog je odbijen.");await load();}catch(e){setMsg(e instanceof Error?e.message:"Odluka nije sačuvana.");}finally{setBusy(null);}}
 const pending=rows.filter(p=>p.status==="na_cekanju");
 return <div className="space-y-3"><div className="flex flex-wrap items-center gap-3"><p className="font-semibold">Predlozi na čekanju: {pending.length}</p><button className={small} onClick={load}>Osveži</button>{msg&&<span className="text-sm text-brand">{msg}</span>}</div>
 {rows.map(p=><div key={p.id} className="rounded-2xl bg-surface p-4 shadow-card"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{p.tabela==="ponude"?"Ponuda":"Zahtev"} · {String(p.predlozeni_podaci?.naslov||p.oglas_id)}</p><p className="text-xs text-muted-foreground">Moderator: {p.moderator_ime||p.moderator_email||p.moderator_id} · {new Date(p.created_at).toLocaleString("sr-RS")}</p></div><span className="text-sm">{p.status==="na_cekanju"?"Čeka odobrenje":p.status==="odobreno"?"Odobreno":"Odbijeno"}</span></div>
  <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Trenutni oglas</p>{Object.entries(p.trenutni_podaci||{}).filter(([k])=>["naslov","opis","kategorija","lokacija","cena","budzet","valuta","kontakt_ime","telefon"].includes(k)).map(([k,v])=><p key={k} className="text-sm"><b>{k}:</b> {String(v??"—")}</p>)}</div><div><p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Predložena izmena</p>{Object.entries(p.predlozeni_podaci||{}).map(([k,v])=><p key={k} className="text-sm"><b>{k}:</b> {String(v??"—")}</p>)}</div></div>
  {p.status==="na_cekanju"&&<div className="mt-3 flex gap-2"><button className={small} disabled={busy===p.id} onClick={()=>decide(p,"odobreno")}>Odobri izmenu</button><button className={danger} disabled={busy===p.id} onClick={()=>decide(p,"odbijeno")}>Odbij</button></div>}{p.admin_napomena&&<p className="mt-2 text-sm text-muted-foreground">Napomena: {p.admin_napomena}</p>}</div>)}
 {!rows.length&&<p className="text-sm text-muted-foreground">Trenutno nema predloga moderatora.</p>}</div>;
}