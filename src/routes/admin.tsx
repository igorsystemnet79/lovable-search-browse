import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useState, type ChangeEvent } from "react";
import { API_ORIGIN, ponudimi, ucitajPravilaPlatforme, sacuvajPravilaPlatforme, ucitajIstorijuPravilaPlatforme, vratiVerzijuPravilaPlatforme, ucitajRezimOdrzavanja, podesiRezimOdrzavanja, ucitajKategorije, dodajKategoriju, dodajPotkategoriju, obrisiKategoriju, obrisiPotkategoriju, izmeniKategoriju, izmeniPotkategoriju, postaviSlikuKategorije, postaviSlikuPodkategorije } from "@/integrations/standalone/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { obrisiKorisnika, sinhronizujApr, dodajAdminFotografije, obrisiAdminFotografiju, posaljiPredlogIzmene, ucitajPredlogeModeratora, ucitajAdminPredloge, odluciOPredlogu, pretraziFirmeZaPaket, ucitajPaketeFirmi, dodeliPaketFirmi, otkaziPaketFirme, ucitajKatalogPaketa, sacuvajKatalogPaketa } from "@/lib/admin.functions";
import { SiteHeader } from "@/components/site-header";
import { defaultPlatformRulesText } from "@/routes/pravila-platforme";
import { SiteFooter } from "@/components/site-footer";
import { inputCls } from "@/components/auth-shell";
import type { Kategorija } from "@/lib/kategorije";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/integrations/standalone/types";
import { obradiPrijavu, ucitajPrijaveOglasa, type PrijavaOglasa } from "@/lib/reports";
import { ucitajAdminStatistiku } from "@/lib/admin.functions";

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
const tabs = ["Korisnici", "Ponude", "Zahtevi", "Prijave", "Statistika", "Odobrenja", "Poruke", "Poruke korisnika", "APR firme", "Paketi firmi", "Ponuda paketa", "Kategorije", "Pravila platforme", "ChatGPT"] as const;
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
                <button key={t} onClick={() => setTab(t)} className={`min-h-10 rounded-full px-4 py-2 text-sm font-medium ${tab === t ? "bg-brand text-brand-foreground" : t === "Pravila platforme" ? "border border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200" : "border border-input hover:bg-secondary"}`}>{t === "Odobrenja" && pendingCount > 0 ? `Odobrenja (${pendingCount})` : t}</button>
              ))}
            </div>
            {tab === "Korisnici" && <Korisnici selfId={user.id} />}
            {tab === "Ponude" && <Oglasi tabela="ponude" />}
            {tab === "Zahtevi" && <Oglasi tabela="zahtevi" />}
            {tab === "Prijave" && <Prijave />}
            {tab === "Statistika" && <Statistika />}
            {tab === "Odobrenja" && <PredloziZaOdobrenje />}
            {tab === "Poruke" && <Poruke />}
            {tab === "Poruke korisnika" && <AdminKorisnickePoruke />}
            {tab === "APR firme" && <Apr />}
            {tab === "Paketi firmi" && <PaketiFirmi />}
            {tab === "Ponuda paketa" && <UpravljanjePonudomPaketa />}
            {tab === "Kategorije" && <UpravljanjeKategorijama />}
            {tab === "Pravila platforme" && <UpravljanjePravilima />}
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
        {isAdmin && <UpravljanjeOdrzavanjem />}
        {body}
      </main>
      <SiteFooter />
    </div>
  );
}


function Statistika() {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setMsg("");
    try {
      setData(await ucitajAdminStatistiku());
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Statistiku nije moguće učitati.");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const number = (value: unknown) => Number(value || 0).toLocaleString("sr-RS");
  const groups = data ? [
    { title: "Korisnici", items: [
      ["Ukupno registrovanih", data.korisnici.total],
      ["Fizička lica", data.korisnici.fizicka],
      ["Pravna lica", data.korisnici.pravna],
      ["Novi korisnici · 7 dana", data.korisnici.novih_7d],
      ["Novi korisnici · 30 dana", data.korisnici.novih_30d],
    ] },
    { title: "Ponude", items: [
      ["Ukupno ponuda", data.ponude.total],
      ["Aktivne ponude", data.ponude.aktivne],
      ["Nove · 7 dana", data.ponude.novih_7d],
      ["Nove · 30 dana", data.ponude.novih_30d],
    ] },
    { title: "Zahtevi", items: [
      ["Ukupno zahteva", data.zahtevi.total],
      ["Aktivni zahtevi", data.zahtevi.aktivni],
      ["Novi · 7 dana", data.zahtevi.novi_7d],
      ["Novi · 30 dana", data.zahtevi.novi_30d],
    ] },
  ] : [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">Pregled platforme</h2><p className="text-sm text-muted-foreground">Broj registrovanih korisnika, ponuda i zahteva.</p></div>
        <button type="button" className={small} disabled={busy} onClick={load}>{busy ? "Učitavanje..." : "Osveži statistiku"}</button>
      </div>
      {msg && <p role="alert" className="text-sm text-destructive">{msg}</p>}
      {data && <div className="grid gap-4 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.title} className="rounded-2xl bg-surface p-4 shadow-card">
            <h3 className="mb-3 font-semibold">{group.title}</h3>
            <div className="grid grid-cols-2 gap-3">
              {group.items.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-input bg-background p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{number(value)}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>}
      {!data && !busy && !msg && <p className="text-sm text-muted-foreground">Statistika još nije učitana.</p>}
      {data?.azurirano_at && <p className="text-xs text-muted-foreground">Poslednje osvežavanje: {new Date(data.azurirano_at).toLocaleString("sr-RS")}</p>}
    </section>
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

  async function decide(item: PrijavaOglasa, status: "pregledano" | "odbijeno" | "oglas_uklonjen" | "vracen_u_prikaz") {
    const napomena = prompt(status === "oglas_uklonjen" ? "Unesi razlog uklanjanja oglasa (opciono):" : status === "vracen_u_prikaz" ? "Napomena o vraćanju oglasa (opciono):" : status === "pregledano" ? "Napomena administratora (opciono):" : "Razlog odbijanja (opciono):");
    if (napomena === null) return;
    setBusy(item.id);
    setMsg("");
    try {
      await obradiPrijavu(item.id, status, napomena);
      setMsg(status === "pregledano" ? "Prijava je označena kao pregledana." : status === "odbijeno" ? "Prijava je odbijena." : status === "oglas_uklonjen" ? "Oglas je uklonjen iz javnog prikaza." : "Oglas je vraćen u javni prikaz.");
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
            <span className={item.status === "na_cekanju" ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800" : "rounded-full bg-secondary px-3 py-1 text-xs font-semibold"}>{item.status === "na_cekanju" ? "Čeka pregled" : item.status === "pregledano" ? "Pregledano" : item.status === "odbijeno" ? "Odbijeno" : item.status === "oglas_uklonjen" ? "Oglas uklonjen" : "Oglas vraćen u prikaz"}</span>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Razlog: </span><b>{reasonLabels[item.razlog] || item.razlog}</b></p>
            <p><span className="text-muted-foreground">Vlasnik oglasa: </span>{item.vlasnik_email || "Nedostupan podatak"}</p>
            <p><span className="text-muted-foreground">Prijavio: </span>{item.prijavio_email || (item.prijavio_id ? "Registrovani korisnik" : "Anonimna prijava")}</p>
            <p className="break-all text-xs text-muted-foreground">ID oglasa: {item.oglas_id}</p>
            {item.oglas_naslov && <Link to="/oglas/$kind/$id" params={{ kind: item.tabela === "ponude" ? "ponuda" : "zahtev", id: item.oglas_id }} className="text-sm font-semibold text-brand hover:underline">Otvori oglas</Link>}
          </div>
          {item.detalji && <p className="mt-3 whitespace-pre-wrap rounded-xl border border-input p-3 text-sm">{item.detalji}</p>}
          {item.admin_napomena && <p className="mt-2 text-sm text-muted-foreground">Napomena administratora: {item.admin_napomena}</p>}
          {item.status === "na_cekanju" && <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={small} disabled={busy === item.id} onClick={() => decide(item, "pregledano")}>Označi kao pregledano</button><button type="button" className={small} disabled={busy === item.id} onClick={() => decide(item, "odbijeno")}>Odbij prijavu</button><button type="button" className={danger} disabled={busy === item.id} onClick={() => decide(item, "oglas_uklonjen")}>Ukloni oglas iz javnog prikaza</button></div>}{item.status === "oglas_uklonjen" && <div className="mt-4"><button type="button" className={small} disabled={busy === item.id} onClick={() => decide(item, "vracen_u_prikaz")}>Vrati oglas u javni prikaz</button></div>}
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
  const [aktivnost, setAktivnost] = useState<Record<string, { ponude: number; zahtevi: number }>>({});
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<Profil | null>(null);
  const [msg, setMsg] = useState("");
  const [passwordInfoOpen, setPasswordInfoOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const ucitajSve = async (tabela: "profiles" | "user_roles" | "ponude" | "zahtevi") => {
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
      const [p, r, ponude, zahtevi] = await Promise.all([ucitajSve("profiles"), ucitajSve("user_roles"), ucitajSve("ponude"), ucitajSve("zahtevi")]);
      setProfili(p as Profil[]);
      const m: Record<string, Uloga[]> = {};
      for (const x of r) (m[x.user_id] ??= []).push(x.role);
      setUloge(m);
      const counts: Record<string, { ponude: number; zahtevi: number }> = {};
      for (const x of ponude) if (x.user_id) (counts[x.user_id] ??= { ponude: 0, zahtevi: 0 }).ponude++;
      for (const x of zahtevi) if (x.user_id) (counts[x.user_id] ??= { ponude: 0, zahtevi: 0 }).zahtevi++;
      setAktivnost(counts);
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
    const profil = p as Profil & { username?: string; user_metadata?: Record<string, unknown>; metadata?: Record<string, unknown> };
    const korisnickoIme = String(p.korisnicko_ime || profil.username || profil.user_metadata?.username || profil.metadata?.username || "");
    const statistika = aktivnost[p.id] ?? { ponude: 0, zahtevi: 0 };
    const statusNaloga = p.blokiran ? "blokiran" : "aktivan";
    const statusFirme = p.firma_verifikovana ? "firma verifikovana" : "firma nije verifikovana";
    const pretraziviTekst = normalizujPretragu(
      [
        p.id, p.ime, p.prezime, p.email, korisnickoIme, p.naziv_firme, p.pib,
        p.telefon, p.grad, p.adresa, p.tip_lica, p.status_trgovca, p.created_at, statusNaloga,
        statusFirme, ...(uloge[p.id] ?? []), statistika.ponude, statistika.zahtevi,
      ]
        .filter((value) => value !== null && value !== undefined && value !== "")
        .join(" ")
    );
    // Svaka uneta reč mora da postoji u podacima, bez obzira na redosled.
    return pojmoviPretrage.every((pojam) => pretraziviTekst.includes(pojam));
  });
  const lista = [...filtrirani].sort((a, b) => {
    if (prikaz === "firme") return collator.compare((a.naziv_firme || "").trim(), (b.naziv_firme || "").trim());
    // Novi nalozi čuvaju ime i prezime u odvojenim kolonama; stariji mogu imati puno ime u polju ime.
    const deloviA = (a.ime || "").trim().split(/\s+/).filter(Boolean);
    const deloviB = (b.ime || "").trim().split(/\s+/).filter(Boolean);
    const imeA = deloviA[0] || "";
    const imeB = deloviB[0] || "";
    const prezimeA = (a.prezime || (deloviA.length > 1 ? deloviA.slice(1).join(" ") : "")).trim() || imeA || a.email || "";
    const prezimeB = (b.prezime || (deloviB.length > 1 ? deloviB.slice(1).join(" ") : "")).trim() || imeB || b.email || "";
    const poPrezimenu = collator.compare(prezimeA, prezimeB);
    const poImenu = collator.compare(imeA, imeB);
    return poPrezimenu || poImenu || collator.compare(a.email || "", b.email || "");
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={prikaz === "fizicka" ? `${small} bg-brand text-brand-foreground` : small} onClick={() => { setPrikaz("fizicka"); setFilter(""); setEdit(null); }}>Fizička lica</button>
          <button type="button" className={prikaz === "firme" ? `${small} bg-brand text-brand-foreground` : small} onClick={() => { setPrikaz("firme"); setFilter(""); setEdit(null); }}>Registrovane firme</button>
        </div>
        <Input className={`${inputCls} min-w-0 w-full sm:max-w-md`} placeholder="Pretraži ime, prezime, e-mail, korisničko ime, telefon..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="whitespace-nowrap text-sm text-muted-foreground">Prikazano: {lista.length} / {profili.filter((p) => prikaz === "firme" ? p.tip_lica === "pravno" : p.tip_lica !== "pravno").length}</span>
        {msg && <span role="status" className="text-sm text-brand">{msg}</span>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-input bg-surface shadow-card">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Ime</th>
              <th className="px-3 py-3">Prezime</th>
              <th className="px-3 py-3">E-mail</th>
              <th className="px-3 py-3">Korisničko ime</th>
              <th className="px-3 py-3">Lozinka</th>
              <th className="px-3 py-3">Telefon / mesto</th>
              <th className="px-3 py-3">Uloge / status</th>
              <th className="px-3 py-3">Aktivnost</th>
              <th className="px-3 py-3">Radnje</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const roles = uloge[p.id] ?? [];
              const profil = p as Profil & { username?: string; user_metadata?: Record<string, unknown>; metadata?: Record<string, unknown> };
              const username = String(p.korisnicko_ime || profil.username || profil.user_metadata?.username || profil.metadata?.username || "—");
              const infoOpen = Boolean(passwordInfoOpen[p.id]);
              return (
                <Fragment key={p.id}>
                  <tr className="border-t border-input align-top">
                    <td className="px-3 py-3 font-medium">{(p.ime || "").trim().split(/\s+/)[0] || "—"}</td>
                    <td className="px-3 py-3">{p.prezime || ((p.ime || "").trim().split(/\s+/).slice(1).join(" ") || "—")}</td>
                    <td className="max-w-[220px] break-all px-3 py-3">{p.email || "—"}</td>
                    <td className="px-3 py-3">{username}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span aria-label="Lozinka je zaštićena">••••••••</span>
                        <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={infoOpen ? "Sakrij objašnjenje lozinke" : "Objasni zaštitu lozinke"} aria-expanded={infoOpen} title="Informacije o zaštiti lozinke" onClick={() => setPasswordInfoOpen((current) => ({ ...current, [p.id]: !current[p.id] }))}>
                          {infoOpen ? "×" : "◉"}
                        </button>
                      </div>
                      {infoOpen && <p className="mt-1 max-w-[190px] text-xs text-muted-foreground">Lozinka je kriptografski zaštićena i ne može se prikazati. Korisnik može postaviti novu lozinku kroz bezbedan postupak promene lozinke.</p>}
                    </td>
                    <td className="px-3 py-3">{p.telefon || "—"}<br /><span className="text-xs text-muted-foreground">{[p.grad, p.adresa].filter(Boolean).join(", ") || "—"}</span></td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1 text-xs">
                        <span>{roles.join(", ") || "bez uloge"}</span>
                        <span className={p.blokiran ? "font-semibold text-destructive" : "text-green-700"}>{p.blokiran ? "Blokiran" : "Aktivan"}</span>
                        <span>Status prodavca: {p.status_trgovca === "trgovac" ? "Trgovac" : p.status_trgovca === "nije_trgovac" ? "Privatno lice" : "Nije potvrđen"}</span>
                        {p.tip_lica === "pravno" && <span>{p.naziv_firme || "Firma"} · PIB {p.pib || "—"} · {p.firma_verifikovana ? "Verifikovana" : "Nije verifikovana"}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      <div>Ponude: {aktivnost[p.id]?.ponude ?? 0}</div>
                      <div>Zahtevi: {aktivnost[p.id]?.zahtevi ?? 0}</div>
                      <div>Registrovan: {p.created_at ? new Date(p.created_at).toLocaleDateString("sr-RS") : "—"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-[150px] flex-wrap gap-1">
                        <button className={small} onClick={() => setEdit(p)}>Izmeni</button>
                        <button className={small} disabled={p.id === selfId} onClick={() => toggleUloga(p.id, "admin")}>{roles.includes("admin") ? "Ukini admina" : "Daj admina"}</button>
                        <button className={small} onClick={() => toggleUloga(p.id, "moderator")}>{roles.includes("moderator") ? "Ukini moderatora" : "Daj moderatora"}</button>
                        <button className={small} disabled={p.id === selfId} onClick={() => update(p.id, { blokiran: !p.blokiran })}>{p.blokiran ? "Odblokiraj" : "Blokiraj"}</button>
                        {p.tip_lica === "pravno" && <button className={small} onClick={() => update(p.id, { firma_verifikovana: !p.firma_verifikovana })}>{p.firma_verifikovana ? "Poništi verifikaciju" : "Verifikuj firmu"}</button>}
                        {p.id !== selfId && <button className={danger} onClick={() => obrisi(p)}>Obriši</button>}
                      </div>
                    </td>
                  </tr>
                  {edit?.id === p.id && (
                    <tr className="border-t border-input bg-background">
                      <td colSpan={9} className="p-4">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {(["ime", "prezime", "korisnicko_ime", "telefon", "grad", "adresa", "naziv_firme", "pib"] as const).map((k) => (
                            <Input key={k} className={inputCls} placeholder={k === "prezime" ? "Prezime" : k === "korisnicko_ime" ? "Korisničko ime" : k} value={(edit as any)[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value || null } as Profil)} />
                          ))}
                          <select className={inputCls} value={edit.status_trgovca || "nepotvrdjeno"} onChange={(e) => setEdit({ ...edit, status_trgovca: e.target.value } as Profil)}>
                            <option value="trgovac">Trgovac</option>
                            <option value="nije_trgovac">Privatno lice</option>
                            <option value="nepotvrdjeno">Nije potvrđen</option>
                          </select>
                          <select className={inputCls} value={edit.tip_lica} onChange={(e) => setEdit({ ...edit, tip_lica: e.target.value } as Profil)}>
                            <option value="fizicko">Fizičko lice</option>
                            <option value="pravno">Pravno lice</option>
                          </select>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button className={small} onClick={() => { const { id, ime, prezime, korisnicko_ime, status_trgovca, telefon, grad, adresa, naziv_firme, pib, tip_lica } = edit as any; update(id, { ime, prezime, korisnicko_ime, status_trgovca, telefon, grad, adresa, naziv_firme, pib, tip_lica }); setEdit(null); }}>Sačuvaj izmene</button>
                          <button className={small} onClick={() => setEdit(null)}>Otkaži</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!lista.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">{prikaz === "firme" ? "Nema registrovanih firmi." : "Nema registrovanih fizičkih lica."}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Na telefonu se tabela može pomerati levo i desno. Lozinke se nikada ne prikazuju u čitljivom obliku.</p>
    </div>
  );
}


type Oglas = { id: string; user_id: string; naslov: string; opis: string | null; kategorija: string; lokacija: string; kontakt_ime: string | null; telefon: string | null; created_at: string; cena?: number | null; budzet?: number | null; valuta?: string; zavrseno?: boolean; pauziran?: boolean };
type AdminImage = { id: string; storage_path: string | null; external_url: string | null; pozicija: number };

function Oglasi({ tabela }: { tabela: "ponude" | "zahtevi" }) {
  const [rows, setRows] = useState<Oglas[]>([]);
  const [edit, setEdit] = useState<Oglas | null>(null);
  const [msg, setMsg] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, AdminImage[]>>({});
  const [imageBusy, setImageBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"sve" | "aktivni" | "pauzirani" | "zavrseni">("sve");
  const [sortOrder, setSortOrder] = useState<"najnovije" | "najstarije" | "naslov">("najnovije");
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
    if (statusFilter === "aktivni" && (o.pauziran || o.zavrseno)) return false;
    if (statusFilter === "pauzirani" && !o.pauziran) return false;
    if (statusFilter === "zavrseni" && !o.zavrseno) return false;
    if (!pojmoviPretrage.length) return true;
    const pretraziviTekst = normalizujPretragu(
      [o.naslov, o.opis, o.kategorija, o.lokacija, o.kontakt_ime, o.telefon, o.user_id, o.id, o[polje], o.valuta]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
    );
    return pojmoviPretrage.every((pojam) => pretraziviTekst.includes(pojam));
  }).sort((a, b) => {
    if (sortOrder === "naslov") return a.naslov.localeCompare(b.naslov, "sr", { sensitivity: "base" });
    const delta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortOrder === "najstarije" ? delta : -delta;
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
        <div className="flex flex-wrap gap-2">
          {([{ value: "sve", label: "Sve" }, { value: "aktivni", label: "Aktivni" }, { value: "pauzirani", label: "Pauzirani" }, { value: "zavrseni", label: "Završeni" }] as const).map((option) => (
            <button key={option.value} type="button" className={statusFilter === option.value ? `${small} bg-brand text-brand-foreground` : small} onClick={() => setStatusFilter(option.value)}>{option.label}</button>
          ))}
        </div>
        <select aria-label="Sortiranje oglasa" className={inputCls + " min-h-10 w-full sm:w-auto"} value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}>
          <option value="najnovije">Najnovije prvo</option>
          <option value="najstarije">Najstarije prvo</option>
          <option value="naslov">Po naslovu A–Š</option>
        </select>
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


function PaketiFirmi() {
 const [q,setQ]=useState("");
 const [firme,setFirme]=useState<any[]>([]);
 const [selected,setSelected]=useState("");
 const [paket,setPaket]=useState("light");
 const [catalog,setCatalog]=useState<any[]>([]);
 const [uplata,setUplata]=useState("ceka_uplatu");
 const [napomena,setNapomena]=useState("");
 const [referenca,setReferenca]=useState("");
 const [rows,setRows]=useState<any[]>([]);
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState("");
 const load=useCallback(async()=>{try{const [r,c]=await Promise.all([ucitajPaketeFirmi(),ucitajKatalogPaketa()]);setRows(r.data||[]);setCatalog(c.data||[]);if(c.data?.length&&!c.data.some((x:any)=>x.slug===paket))setPaket(c.data[0].slug);}catch(e){setMsg(e instanceof Error?e.message:"Pakete nije moguće učitati.");}},[paket]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{let active=true;const timer=setTimeout(()=>{pretraziFirmeZaPaket(q).then(r=>{if(active)setFirme(r.data||[]);}).catch(()=>{if(active)setFirme([]);});},250);return()=>{active=false;clearTimeout(timer);};},[q]);
 async function submit(){if(!selected){setMsg("Izaberi firmu.");return;}setBusy(true);setMsg("");try{const r=await dodeliPaketFirmi({user_id:selected,paket,status_uplate:uplata,napomena,referenca_uplate:referenca});setMsg(r.poruka||"Paket je sačuvan.");setSelected("");setNapomena("");setReferenca("");await load();}catch(e){setMsg(e instanceof Error?e.message:"Paket nije sačuvan.");}finally{setBusy(false);}}
 async function cancel(id:string){if(!window.confirm("Otkazati ovaj paket?"))return;setBusy(true);try{await otkaziPaketFirme(id);setMsg("Paket je otkazan.");await load();}catch(e){setMsg(e instanceof Error?e.message:"Paket nije otkazan.");}finally{setBusy(false);}}
 const labels:Record<string,string>={mesecni:"Mesečni paket",tromesecni:"Tromesečni paket",sestomesecni:"Šestomesečni paket",godisnji:"Godišnji paket",...Object.fromEntries(catalog.map((p:any)=>[p.slug,`${p.naziv} — ${Number(p.cena_eur).toFixed(2)} € / ${p.trajanje_meseci} mes.`]))};
 return <div className="space-y-5">
  <section className="rounded-2xl border border-input bg-surface p-4">
   <h2 className="font-semibold">Dodela paketa pravnom licu</h2>
   <p className="mt-1 text-sm text-muted-foreground">Paket može dobiti samo APR-verifikovana firma. Aktivacija je moguća nakon evidentirane uplate ili kada administrator označi da je paket oslobođen plaćanja.</p>
   <div className="mt-3 grid gap-3 md:grid-cols-2">
    <div><label className="mb-1 block text-xs font-medium">Pretraga firme po nazivu, PIB-u ili e-mailu</label><Input className={inputCls} value={q} onChange={e=>setQ(e.target.value)} placeholder="Unesi naziv firme, PIB ili e-mail"/></div>
    <div><label className="mb-1 block text-xs font-medium">Izaberi firmu</label><select className={inputCls} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Izaberi firmu</option>{firme.map(f=><option key={f.user_id} value={f.user_id}>{f.naziv_firme||"Firma"} · PIB {f.pib||"—"} · {f.firma_verifikovana?"Verifikovana":"Nije verifikovana"}</option>)}</select></div>
    <div><label className="mb-1 block text-xs font-medium">Paket</label><select className={inputCls} value={paket} onChange={e=>setPaket(e.target.value)}>{catalog.filter((p:any)=>p.objavljen).map((p:any)=><option key={p.slug} value={p.slug}>{p.naziv} — {Number(p.cena_eur).toFixed(2)} € / {p.trajanje_meseci} mes.</option>)}</select></div>
    <div><label className="mb-1 block text-xs font-medium">Status uplate</label><select className={inputCls} value={uplata} onChange={e=>setUplata(e.target.value)}><option value="ceka_uplatu">Čeka uplatu — bez aktivacije</option><option value="placeno">Plaćeno — aktiviraj</option><option value="oslobodjeno">Oslobođeno plaćanja — aktiviraj</option></select></div>
    <div><label className="mb-1 block text-xs font-medium">Referenca uplate (opciono)</label><Input className={inputCls} value={referenca} onChange={e=>setReferenca(e.target.value)} placeholder="Broj transakcije / poziv na broj"/></div>
    <div><label className="mb-1 block text-xs font-medium">Administratorska napomena (opciono)</label><Input className={inputCls} value={napomena} onChange={e=>setNapomena(e.target.value)} placeholder="Napomena"/></div>
   </div>
   <button type="button" className="mt-3 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50" disabled={busy||!selected} onClick={()=>void submit()}>{busy?"Sačekaj...":"Sačuvaj paket"}</button>
   {msg&&<p role="status" className="mt-3 text-sm">{msg}</p>}
  </section>
  <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">Evidencija paketa</h2><button className={small} onClick={()=>void load()} disabled={busy}>Osveži</button></div>
   <div className="overflow-x-auto rounded-2xl bg-surface shadow-card"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-muted-foreground"><tr><th className="p-3">Firma / PIB</th><th className="p-3">Paket</th><th className="p-3">Uplata</th><th className="p-3">Važi do</th><th className="p-3">Status</th><th className="p-3">Podsetnik</th><th className="p-3">Radnja</th></tr></thead><tbody>
   {rows.map(r=><tr key={r.id} className="border-t border-input"><td className="p-3">{r.naziv_firme||"Firma"}<br/><span className="text-xs text-muted-foreground">PIB {r.pib||"—"} · {r.email||"—"}</span></td><td className="p-3">{labels[r.paket]||r.paket}<br/><span className="text-xs text-muted-foreground">{Number(r.cena_eur).toFixed(2)} €</span></td><td className="p-3">{r.status_uplate==="placeno"?"Plaćeno":r.status_uplate==="oslobodjeno"?"Oslobođeno":"Čeka uplatu"}</td><td className="p-3">{new Date(r.vazi_do).toLocaleDateString("sr-RS",{timeZone:"UTC"})}</td><td className="p-3">{r.status==="aktivan"?"Aktivan":r.status==="na_cekanju"?"Na čekanju":r.status==="istekao"?"Istekao":"Otkazan"}</td><td className="p-3">{r.email_podsetnik_poslat_at?"E-mail poslat":r.email_podsetnik_greska?"Greška pri slanju":"Čeka termin"}</td><td className="p-3">{["aktivan","na_cekanju"].includes(r.status)&&<button className={danger} disabled={busy} onClick={()=>void cancel(r.id)}>Otkaži</button>}</td></tr>)}
   {!rows.length&&<tr><td colSpan={7} className="p-4 text-muted-foreground">Još nema evidentiranih paketa.</td></tr>}
   </tbody></table></div>
  </section>
 </div>;
}


function UpravljanjePonudomPaketa(){
 const [items,setItems]=useState<any[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 const load=useCallback(async()=>{try{const r=await ucitajKatalogPaketa();setItems(r.data||[]);}catch(e){setMsg(e instanceof Error?e.message:"Cenovnik nije moguće učitati.");}},[]);
 useEffect(()=>{void load();},[load]);
 function update(slug:string,field:string,value:any){setItems(old=>old.map(item=>item.slug===slug?{...item,[field]:value}:item));}
 async function save(){setBusy(true);setMsg("");try{const r=await sacuvajKatalogPaketa(items);setItems(r.data||items);setMsg(r.poruka||"Ponuda paketa je sačuvana.");}catch(e){setMsg(e instanceof Error?e.message:"Ponuda nije sačuvana.");}finally{setBusy(false);}}
 return <section className="space-y-5"><div><h2 className="text-xl font-semibold">Ponuda paketa za firme</h2><p className="mt-1 text-sm text-muted-foreground">Ovde uređuješ cene, trajanje, opis i pogodnosti. Samo paketi označeni za objavu prikazuju se u javnom odeljku „Za firme“. Sačuvane izmene važe i za buduće dodele paketa; ranije evidentirane uplate ostaju nepromenjene.</p></div>
 {items.map(item=><article key={item.slug} className="space-y-3 rounded-2xl border border-input bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">{item.naziv}</h3><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{item.slug.toUpperCase()}</span></div>
 <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm font-medium">Naziv paketa<input className={inputCls} value={item.naziv} maxLength={40} onChange={e=>update(item.slug,"naziv",e.target.value)}/></label>
 <label className="space-y-1 text-sm font-medium">Cena (EUR)<input className={inputCls} type="number" min="0" max="100000" step="0.01" value={item.cena_eur} onChange={e=>update(item.slug,"cena_eur",e.target.value===""?"":Number(e.target.value))}/></label>
 <label className="space-y-1 text-sm font-medium">Trajanje (meseci)<input className={inputCls} type="number" min="1" max="36" step="1" value={item.trajanje_meseci} onChange={e=>update(item.slug,"trajanje_meseci",Number(e.target.value))}/></label>
 <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={Boolean(item.objavljen)} onChange={e=>update(item.slug,"objavljen",e.target.checked)}/> Objavi ovaj paket u odeljku „Za firme“</label></div>
 <label className="block space-y-1 text-sm font-medium">Objašnjenje paketa<textarea className={inputCls+" min-h-24"} value={item.opis||""} maxLength={2000} onChange={e=>update(item.slug,"opis",e.target.value)} placeholder="Objasni kome je paket namenjen i šta korisnik dobija."/></label>
 <label className="block space-y-1 text-sm font-medium">Pogodnosti (svaka u posebnom redu)<textarea className={inputCls+" min-h-28"} value={(item.pogodnosti||[]).join("\n")} onChange={e=>update(item.slug,"pogodnosti",e.target.value.split("\n").map((x:string)=>x.trim()).filter(Boolean).slice(0,12))} placeholder={"Primer pogodnosti 1\nPrimer pogodnosti 2"}/></label>
 </article>)}
 <div className="flex flex-wrap items-center gap-3"><button type="button" className="min-h-11 rounded-full bg-brand px-6 py-2 font-semibold text-brand-foreground disabled:opacity-50" disabled={busy||items.length!==4} onClick={()=>void save()}>{busy?"Čuvanje...":"Sačuvaj ponudu paketa"}</button><button type="button" className={small} disabled={busy} onClick={()=>void load()}>Učitaj sačuvane podatke</button></div>{msg&&<p role="status" className="text-sm">{msg}</p>}</section>;
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

function UpravljanjeKategorijama(){
 const queryClient=useQueryClient(),{data:categories=[],isLoading,isError,refetch}=useQuery({queryKey:["platform-categories"],queryFn:ucitajKategorije,staleTime:0});
 const [groupName,setGroupName]=useState(""),[subcategoryName,setSubcategoryName]=useState(""),[selectedSlug,setSelectedSlug]=useState(""),[mode,setMode]=useState<"group"|"subcategory">("group"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [groupFile,setGroupFile]=useState<File|null>(null),[groupUrl,setGroupUrl]=useState(""),[subcategoryFile,setSubcategoryFile]=useState<File|null>(null),[subcategoryUrl,setSubcategoryUrl]=useState("");
 const [editingGroup,setEditingGroup]=useState<string|null>(null),[editGroupName,setEditGroupName]=useState("");
 const [editingSub,setEditingSub]=useState<{slug:string;name:string}|null>(null),[editSubName,setEditSubName]=useState("");
 useEffect(()=>{if(!selectedSlug&&categories.length)setSelectedSlug(categories[0].slug);},[categories,selectedSlug]);
 const selectedCategory=categories.find(c=>c.slug===selectedSlug);
 async function refreshCategories(){await queryClient.invalidateQueries({queryKey:["platform-categories"]});await refetch();}
 async function saveGroup(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError("");setNotice("");try{
  if(categories.some(c=>c.naziv.trim().toLocaleLowerCase("sr")===groupName.trim().toLocaleLowerCase("sr")))throw new Error("Grupa sa tim nazivom već postoji.");
  if(groupFile&&groupUrl.trim())throw new Error("Izaberi fotografiju sa uređaja ili unesi link, ne oba načina istovremeno.");
  const created=await dodajKategoriju(groupName),slug=created.data?.slug;
  if(!slug)throw new Error("Grupa je kreirana, ali server nije vratio njenu oznaku.");
  const hasImage=Boolean(groupFile||groupUrl.trim());
  if(groupFile||groupUrl.trim())await postaviSlikuKategorije(slug,groupFile,groupUrl.trim()||undefined);
  setGroupName("");setGroupFile(null);setGroupUrl("");await refreshCategories();setNotice("Nova grupa je sačuvana"+(hasImage?" zajedno sa fotografijom":"")+". Odmah je dostupna na naslovnoj strani, u objavi i pretrazi.");
 }catch(e){setError(e instanceof Error?e.message:"Grupu nije moguće sačuvati.");}finally{setBusy(false);}}
 async function saveGroupEdit(category:Kategorija){if(busy)return;setBusy(true);setError("");setNotice("");try{await izmeniKategoriju(category.slug,editGroupName);setEditingGroup(null);await refreshCategories();setNotice("Izmena grupe je uspešno sačuvana.");}catch(e){setError(e instanceof Error?e.message:"Izmena grupe nije uspela.");}finally{setBusy(false);}}
 async function saveSubEdit(category:Kategorija,oldName:string){if(busy)return;setBusy(true);setError("");setNotice("");try{await izmeniPotkategoriju(category.slug,oldName,editSubName);setEditingSub(null);await refreshCategories();setNotice("Izmena podgrupe je uspešno sačuvana.");}catch(e){setError(e instanceof Error?e.message:"Izmena podgrupe nije uspela.");}finally{setBusy(false);}}
 async function deleteGroup(category:Kategorija){if(busy)return;if(!window.confirm(`Obrisati grupu „${category.naziv}“ i sve njene podgrupe? Ova radnja uklanja grupu iz izbora kategorija. Postojeći oglasi i zahtevi neće biti obrisani.`))return;setBusy(true);setError("");setNotice("");try{await obrisiKategoriju(category.slug,category.naziv);if(selectedSlug===category.slug)setSelectedSlug("");await refreshCategories();setNotice(`Grupa „${category.naziv}“ je obrisana.`);}catch(e){setError(e instanceof Error?e.message:"Grupu nije moguće obrisati.");}finally{setBusy(false);}}
 async function deleteSubcategory(category:Kategorija,name:string){if(busy)return;if(!window.confirm(`Obrisati podgrupu „${name}“ iz grupe „${category.naziv}“? Postojeći oglasi i zahtevi neće biti obrisani.`))return;setBusy(true);setError("");setNotice("");try{await obrisiPotkategoriju(category.slug,name);await refreshCategories();setNotice(`Podgrupa „${name}“ je obrisana.`);}catch(e){setError(e instanceof Error?e.message:"Podgrupu nije moguće obrisati.");}finally{setBusy(false);}}
 async function saveSubcategory(e:React.FormEvent){e.preventDefault();if(busy||!selectedSlug)return;setBusy(true);setError("");setNotice("");try{
  if(subcategoryFile&&subcategoryUrl.trim())throw new Error("Izaberi fotografiju sa uređaja ili unesi link, ne oba načina istovremeno.");
  await dodajPotkategoriju(selectedSlug,subcategoryName,selectedCategory?.naziv||"");
  const hasImage=Boolean(subcategoryFile||subcategoryUrl.trim());
  if(subcategoryFile||subcategoryUrl.trim())await postaviSlikuPodkategorije(selectedSlug,subcategoryName,subcategoryFile,subcategoryUrl.trim()||undefined);
  setSubcategoryName("");setSubcategoryFile(null);setSubcategoryUrl("");await refreshCategories();setNotice("Nova podgrupa je sačuvana"+(hasImage?" zajedno sa fotografijom":"")+". Odmah je dostupna u izboru kategorija i pretrazi.");
 }catch(e){setError(e instanceof Error?e.message:"Podgrupu nije moguće sačuvati.");}finally{setBusy(false);}}
 const fileHelp="JPG, PNG ili WebP · najviše 20 MB · automatska obrada na 800 × 600";
 return <section className="space-y-5"><div><h2 className="text-xl font-semibold">Upravljanje grupama i podgrupama</h2><p className="mt-1 text-sm text-muted-foreground">Nove kategorije se čuvaju u bazi i automatski postaju dostupne na naslovnoj strani, u objavi oglasa, objavi zahteva i pretrazi. Fotografiju možeš dodati sa uređaja ili preko HTTPS linka.</p></div>
 <div className="flex flex-wrap gap-2"><button type="button" className={mode==="group"?"min-h-10 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground":"min-h-10 rounded-full border border-input px-4 py-2 text-sm"} onClick={()=>{setMode("group");setError("");setNotice("");}}>Dodaj novu grupu</button><button type="button" className={mode==="subcategory"?"min-h-10 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground":"min-h-10 rounded-full border border-input px-4 py-2 text-sm"} onClick={()=>{setMode("subcategory");setError("");setNotice("");}}>Dodaj novu podgrupu</button></div>
 {mode==="group"?<form onSubmit={saveGroup} className="max-w-xl space-y-3 rounded-2xl border border-input bg-surface p-4">
  <label className="block space-y-1 text-sm font-medium">Naziv nove grupe<Input className={inputCls} value={groupName} onChange={e=>setGroupName(e.target.value)} maxLength={80} minLength={2} required placeholder="Npr. Baštenska oprema"/></label>
  <label className="block space-y-1 text-sm font-medium">Fotografija sa uređaja<Input className={inputCls} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setGroupFile(e.target.files?.[0]??null)}/><span className="block text-xs font-normal text-muted-foreground">{fileHelp}</span>{groupFile&&<span className="block text-xs text-muted-foreground">Izabrano: {groupFile.name}</span>}</label>
  <label className="block space-y-1 text-sm font-medium">Ili link do fotografije (HTTPS)<Input className={inputCls} type="url" value={groupUrl} onChange={e=>setGroupUrl(e.target.value)} placeholder="https://primer.com/fotografija.jpg"/></label>
  <button type="submit" className="min-h-10 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50" disabled={busy}>{busy?"Čuvanje...":"Sačuvaj grupu"}</button>
 </form>:<form onSubmit={saveSubcategory} className="max-w-xl space-y-3 rounded-2xl border border-input bg-surface p-4">
  <label className="block space-y-1 text-sm font-medium">Izaberi grupu<select className={inputCls} value={selectedSlug} onChange={e=>setSelectedSlug(e.target.value)} required>{categories.map(c=><option key={c.slug} value={c.slug}>{c.naziv}</option>)}</select></label>
  <label className="block space-y-1 text-sm font-medium">Naziv nove podgrupe<Input className={inputCls} value={subcategoryName} onChange={e=>setSubcategoryName(e.target.value)} maxLength={80} minLength={2} required placeholder="Npr. Tuš kabine"/></label>
  <label className="block space-y-1 text-sm font-medium">Fotografija sa uređaja<Input className={inputCls} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setSubcategoryFile(e.target.files?.[0]??null)}/><span className="block text-xs font-normal text-muted-foreground">{fileHelp}</span>{subcategoryFile&&<span className="block text-xs text-muted-foreground">Izabrano: {subcategoryFile.name}</span>}</label>
  <label className="block space-y-1 text-sm font-medium">Ili link do fotografije (HTTPS)<Input className={inputCls} type="url" value={subcategoryUrl} onChange={e=>setSubcategoryUrl(e.target.value)} placeholder="https://primer.com/fotografija.jpg"/></label>
  <button type="submit" className="min-h-10 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50" disabled={busy||!categories.length}>{busy?"Čuvanje...":"Sačuvaj podgrupu"}</button>
 </form>}
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
 <div className="rounded-2xl bg-surface p-4 shadow-card"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Trenutne grupe i podgrupe</h3><button type="button" className={small} onClick={()=>void refetch()} disabled={isLoading}>Osveži</button></div>{isLoading&&<p className="text-sm text-muted-foreground">Učitavanje kategorija...</p>}{isError&&<p role="alert" className="text-sm text-destructive">Kategorije trenutno nisu dostupne.</p>}<div className="grid gap-3 sm:grid-cols-2">{categories.map(c=><article key={c.slug} className="rounded-xl border border-input p-3"><div className="flex items-center gap-3"><img src={c.slika} alt="" className="h-14 w-20 rounded-lg object-cover"/>{editingGroup===c.slug?<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2"><Input className={inputCls+" min-w-0 flex-1"} value={editGroupName} onChange={e=>setEditGroupName(e.target.value)} maxLength={80}/><button type="button" className={small} disabled={busy||editGroupName.trim().length<2} onClick={()=>void saveGroupEdit(c)}>Sačuvaj</button><button type="button" className={small} disabled={busy} onClick={()=>setEditingGroup(null)}>Odustani</button></div>:<div className="min-w-0 flex-1"><h4 className="font-semibold">{c.naziv}</h4><button type="button" className={small+" mt-1"} disabled={busy} onClick={()=>{setEditingGroup(c.slug);setEditGroupName(c.naziv);}}>Izmeni grupu</button></div>}<button type="button" className={danger} disabled={busy} onClick={()=>void deleteGroup(c)}>Obriši grupu</button></div><div className="mt-2 space-y-2">{c.podkategorije.length?c.podkategorije.map(sub=><div key={sub} className="flex items-center gap-2 text-xs text-muted-foreground">{c.podkategorijeSlike?.[sub]&&<img src={c.podkategorijeSlike[sub]} alt="" className="h-9 w-12 rounded object-cover"/>}{editingSub?.slug===c.slug&&editingSub.name===sub?<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1"><Input className={inputCls+" min-w-0 flex-1"} value={editSubName} onChange={e=>setEditSubName(e.target.value)} maxLength={80}/><button type="button" className={small} disabled={busy||editSubName.trim().length<2} onClick={()=>void saveSubEdit(c,sub)}>Sačuvaj</button><button type="button" className={small} disabled={busy} onClick={()=>setEditingSub(null)}>Odustani</button></div>:<><span className="flex-1">{sub}</span><button type="button" className={small} disabled={busy} onClick={()=>{setEditingSub({slug:c.slug,name:sub});setEditSubName(sub);}}>Izmeni</button></>}<button type="button" className={small} disabled={busy} onClick={()=>void deleteSubcategory(c,sub)}>Obriši</button></div>):<p className="text-xs text-muted-foreground">Još nema podgrupa.</p>}</div></article>)}</div></div></section>;
}
function UpravljanjePravilima() {
  // Uvek prikaži kompletan tekst pravila odmah, čak i ako API istorije privremeno nije dostupan.
  const [text, setText] = useState(defaultPlatformRulesText);
  const [history, setHistory] = useState<any[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async (options?: { clearNotice?: boolean }) => {
    setBusy(true);
    setError("");
    if (options?.clearNotice) setMessage("");
    try {
      const current = await ucitajPravilaPlatforme();
      setText(current.data?.sadrzaj || defaultPlatformRulesText);
      setVersion(current.data?.version ?? null);
    } catch (e) {
      setText(previous => previous.trim() ? previous : defaultPlatformRulesText);
      setError(e instanceof Error ? e.message : "Objavljena pravila nije moguće učitati. Prikazan je kompletan osnovni tekst.");
    }
    try {
      const past = await ucitajIstorijuPravilaPlatforme();
      setHistory(past.data || []);
    } catch {
      setHistory([]);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function publish() {
    if (!window.confirm("Objaviti novu verziju pravila? Ona će odmah postati vidljiva svim posetiocima.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await sacuvajPravilaPlatforme(text);
      if (!result?.data?.version) throw new Error("Server nije potvrdio objavljivanje pravila.");
      setVersion(result.data.version);
      await load();
      setMessage(`Nova verzija pravila (verzija ${result.data.version}) je uspešno objavljena.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Objavljivanje nije uspelo.");
    } finally {
      setBusy(false);
    }
  }
  async function restore(id: string) {
    if (!window.confirm("Vratiti izabranu verziju? Ona će biti objavljena kao nova verzija.")) return;
    setBusy(true); setError(""); setMessage("");
    try { const result = await vratiVerzijuPravilaPlatforme(id); setText(result.data.sadrzaj); setVersion(result.data.version); setMessage("Izabrana verzija je vraćena i objavljena."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Vraćanje verzije nije uspelo."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm"><h2 className="font-semibold">Upravljanje pravilima platforme</h2><p className="mt-1 text-sm">Izmene i objavljivanje dostupni su isključivo administratoru. Objavljeni tekst odmah se prikazuje na javnoj stranici „Pravila platforme“.</p><p className="mt-2 text-xs">Trenutna verzija: {version ?? "Još nije objavljena iz administracije"}</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm text-green-700">{message}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Kompletan tekst pravila platforme</h3><p className="text-xs text-muted-foreground">Sva pravila su dostupna za uređivanje u jednom polju. Izmene postaju javne tek kada izabereš „Sačuvaj i objavi pravila“.</p></div><button type="button" className={small} onClick={() => { if (window.confirm("Učitati kompletan osnovni tekst pravila? Time će se zameniti trenutni sadržaj polja, bez objavljivanja.")) { setText(defaultPlatformRulesText); setMessage("Učitan je kompletan osnovni tekst. Sačuvaj i objavi kada završiš izmene."); setError(""); } }} disabled={busy}>Učitaj kompletna osnovna pravila</button></div>
    <label className="block space-y-2"><span className="text-sm font-semibold">Tekst svih pravila — slobodno uređivanje</span><textarea value={text} onChange={e => setText(e.target.value)} rows={30} maxLength={50000} disabled={busy} placeholder="Kompletan tekst pravila platforme..." className="w-full min-h-[650px] rounded-xl border border-input bg-background p-4 text-sm leading-6 outline-none focus:ring-2 focus:ring-amber-400" /></label>
    <div className="rounded-2xl border border-border bg-surface p-4"><h3 className="font-semibold">Pregled teksta</h3><div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl bg-background p-4 text-sm leading-6 text-muted-foreground">{text || "Pregled će se prikazati kada uneseš tekst pravila."}</div></div>
    <div className="flex flex-wrap gap-2"><button type="button" className="min-h-10 rounded-full border border-input px-4 py-2 text-sm font-medium hover:bg-secondary" onClick={() => void load()} disabled={busy}>Osveži</button><button type="button" className="min-h-10 rounded-full border border-amber-400 bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-200 disabled:opacity-50" onClick={() => void publish()} disabled={busy || text.trim().length < 30}>{busy ? "Sačekaj..." : "Sačuvaj i objavi pravila"}</button></div>
    <div className="rounded-2xl border border-border bg-surface p-4"><h3 className="font-semibold">Istorija objavljenih verzija</h3><p className="mt-1 text-xs text-muted-foreground">Čuva se do 50 poslednjih verzija u pregledu. Vraćanje stare verzije objavljuje je kao novu, bez brisanja istorije.</p><div className="mt-3 space-y-2">{history.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"><div><p className="text-sm font-semibold">Verzija {item.version}</p><p className="text-xs text-muted-foreground">{new Date(item.published_at).toLocaleString("sr-RS")}</p></div><button type="button" className={small} onClick={() => void restore(item.id)} disabled={busy || item.version === version}>Vrati ovu verziju</button></div>)}{!history.length && <p className="text-sm text-muted-foreground">Još nema objavljenih verzija kroz ovaj panel.</p>}</div></div>
  </section>;
}

function UpravljanjeOdrzavanjem() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { const result = await ucitajRezimOdrzavanja(); setEnabled(Boolean(result.enabled)); setUpdatedAt(result.updated_at || null); }
    catch (e) { setError(e instanceof Error ? e.message : "Status održavanja nije moguće učitati."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function toggle() {
    const next = !enabled;
    const promptText = next ? "Uključiti režim održavanja? Svi posetioci i korisnici, osim administratora, videće obaveštenje i neće moći da koriste platformu." : "Isključiti režim održavanja i ponovo omogućiti korišćenje platforme?";
    if (!window.confirm(promptText)) return;
    setBusy(true); setError("");
    try { const result = await podesiRezimOdrzavanja(next); setEnabled(Boolean(result.enabled)); setUpdatedAt(result.updated_at || null); }
    catch (e) { setError(e instanceof Error ? e.message : "Promena režima održavanja nije uspela."); }
    finally { setBusy(false); }
  }
  return <section className="mb-7 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><h2 className="font-semibold">Režim održavanja</h2><p className="mt-1 text-sm">Privremeno zaustavlja korišćenje platforme za posetioce i korisnike. Administratori zadržavaju pristup Admin panelu.</p><p className="mt-2 text-xs font-semibold">{enabled ? "REŽIM ODRŽAVANJA JE UKLJUČEN" : "PLATFORMA RADI NORMALNO"}{updatedAt ? ` · ${new Date(updatedAt).toLocaleString("sr-RS")}` : ""}</p></div>
      <button type="button" onClick={() => void toggle()} disabled={busy} className={"min-h-11 shrink-0 rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 " + (enabled ? "border border-green-700 bg-green-100 text-green-900 hover:bg-green-200" : "border border-amber-400 bg-amber-200 text-amber-950 hover:bg-amber-300")}>{busy ? "Učitavanje..." : enabled ? "Isključi održavanje" : "Uključi održavanje"}</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}


type AdminMessageArchive = {
 id:string; conversation_id:string|null; file_name:string; sha256:string; message_count:number;
 created_by_email:string|null; export_reason:string; created_at:string; listing_type:string|null;
 listing_title:string|null; buyer_name:string|null; seller_name:string|null;
};

type AdminConversation = {
 id: string; listing_type: "ponude" | "zahtevi"; listing_id: string; listing_title: string | null;
 buyer_id: string; seller_id: string; buyer_email: string; buyer_name: string;
 seller_email: string; seller_name: string; created_at: string; updated_at: string;
 last_message_at: string | null; message_count: number;
};
type AdminConversationMessage = { id: string; sender_id: string; body: string; created_at: string; read_at: string | null };

function AdminKorisnickePoruke() {
 const [rows,setRows]=useState<AdminConversation[]>([]);
 const [archives,setArchives]=useState<AdminMessageArchive[]>([]);
 const [messages,setMessages]=useState<AdminConversationMessage[]>([]);
 const [selected,setSelected]=useState<AdminConversation|null>(null);
 const [filter,setFilter]=useState("");
 const [reason,setReason]=useState("");
 const [selectedReason,setSelectedReason]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const token=()=>{try{return JSON.parse(localStorage.getItem("ponudimi_session")||"null")?.access_token||"";}catch{return "";}};
 const headers=()=>({Authorization:`Bearer ${token()}`,"Content-Type":"application/json"});
 const load=useCallback(async()=>{
  setBusy(true);setError("");
  try{
   const params=new URLSearchParams();if(filter.trim())params.set("q",filter.trim());
   const response=await fetch(`${API_ORIGIN}/api/admin/messages?${params.toString()}`,{cache:"no-store",headers:headers()});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Razgovori korisnika nisu dostupni.");
   setRows(data.data||[]);
  }catch(e){setError(e instanceof Error?e.message:"Greška pri učitavanju razgovora.");}
  finally{setBusy(false);}
 },[filter]);
 async function loadArchives(){
  try{
   const response=await fetch(`${API_ORIGIN}/api/admin/message-archives`,{cache:'no-store',headers:headers()});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Arhive prepiski nisu dostupne.');
   setArchives(data.data||[]);
  }catch(e){setError(e instanceof Error?e.message:'Greška pri učitavanju arhiva.');}
 }
 useEffect(()=>{load();loadArchives();},[load]);
 async function exportConversation(){
  if(!selected||reason.trim().length<10){setError("Pre izvoza unesi razlog od najmanje 10 karaktera.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch(`${API_ORIGIN}/api/admin/messages/${encodeURIComponent(selected.id)}/export?reason=${encodeURIComponent(reason.trim())}`,{headers:headers()});
   if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||"Izvoz prepiske nije uspeo.");}
   const blob=await response.blob();
   const url=URL.createObjectURL(blob);
   const link=document.createElement("a");
   link.href=url;link.download=`ponudimi-prepiska-${selected.id}.txt`;
   document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
   setNotice("Tekstualna prepiska (.txt) sačuvana je u arhivi i preuzeta na uređaj.");
   await loadArchives();
  }catch(e){setError(e instanceof Error?e.message:"Greška pri izvozu prepiske.");}
  finally{setBusy(false);}
 }
 async function downloadArchive(archive:AdminMessageArchive){
  setBusy(true);setError('');
  try{
   const response=await fetch(`${API_ORIGIN}/api/admin/message-archives/${encodeURIComponent(archive.id)}/download`,{cache:'no-store',headers:headers()});
   if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Preuzimanje arhive nije uspelo.');}
   const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=archive.file_name.replace(/\.json$/i,'.txt').replace(/\.txt$/i,'')+'.txt';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
   setNotice('Tekstualna prepiska (.txt) je preuzeta. Preuzimanje je evidentirano.');
  }catch(e){setError(e instanceof Error?e.message:'Greška pri preuzimanju arhive.');}
  finally{setBusy(false);}
 }
 async function deleteArchive(archive:AdminMessageArchive){
  if(reason.trim().length<10){setError('Pre brisanja arhive unesi razlog od najmanje 10 karaktera.');return;}
  if(!window.confirm('Trajno obrisati sačuvanu arhivu prepiske? Preuzeta kopija na tvom uređaju neće biti obrisana.'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch(`${API_ORIGIN}/api/admin/message-archives/${encodeURIComponent(archive.id)}`,{method:'DELETE',headers:headers(),body:JSON.stringify({reason:reason.trim()})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Brisanje arhive nije uspelo.');
   setArchives(current=>current.filter(item=>item.id!==archive.id));
   setNotice('Arhiva je trajno obrisana sa servera. Radnja je evidentirana u administratorskoj evidenciji.');
  }catch(e){setError(e instanceof Error?e.message:'Greška pri brisanju arhive.');}
  finally{setBusy(false);}
 }
 async function deleteMessage(message:AdminConversationMessage){
  if(!selected||reason.trim().length<10){setError("Pre brisanja unesi razlog od najmanje 10 karaktera.");return;}
  if(!window.confirm("Trajno obrisati ovu poruku? Ova radnja se ne može poništiti."))return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch(`${API_ORIGIN}/api/admin/messages/${encodeURIComponent(selected.id)}/message/${encodeURIComponent(message.id)}`,{method:"DELETE",headers:headers(),body:JSON.stringify({reason:reason.trim()})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Brisanje poruke nije uspelo.");
   setReason("");setMessages(current=>current.filter(item=>item.id!==message.id));
   setRows(current=>current.map(row=>row.id===selected.id?{...row,message_count:Math.max(0,row.message_count-1)}:row));
   setNotice("Poruka je obrisana. Radnja je zabeležena u administratorskoj evidenciji.");
  }catch(e){setError(e instanceof Error?e.message:"Greška pri brisanju poruke.");}
  finally{setBusy(false);}
 }
 async function deleteConversation(){
  if(!selected||reason.trim().length<10){setError("Pre brisanja unesi razlog od najmanje 10 karaktera.");return;}
  if(!window.confirm("Trajno obrisati ceo razgovor i sve poruke između ovih korisnika? Ova radnja se ne može poništiti."))return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch(`${API_ORIGIN}/api/admin/messages/${encodeURIComponent(selected.id)}`,{method:"DELETE",headers:headers(),body:JSON.stringify({reason:reason.trim()})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Brisanje razgovora nije uspelo.");
   setRows(current=>current.filter(row=>row.id!==selected.id));setSelected(null);setMessages([]);setSelectedReason("");setReason("");
   setNotice("Razgovor i sve njegove poruke su obrisani. Radnja je zabeležena u administratorskoj evidenciji.");
  }catch(e){setError(e instanceof Error?e.message:"Greška pri brisanju razgovora.");}
  finally{setBusy(false);}
 }
 async function openConversation(row:AdminConversation){
  const reviewReason=reason.trim();
  setSelected(null);setMessages([]);setSelectedReason("");setError("");setNotice("");
  if(reviewReason.length<10){setError("Pre pregleda privatne prepiske unesi opravdan razlog od najmanje 10 karaktera.");return;}
  setBusy(true);
  try{
   const response=await fetch(`${API_ORIGIN}/api/admin/messages/${encodeURIComponent(row.id)}/view`,{method:"POST",headers:headers(),body:JSON.stringify({reason:reviewReason})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Pregled razgovora nije dozvoljen.");
   setSelected(row);setMessages(data.messages||[]);setSelectedReason(reviewReason);setNotice("Pristup razgovoru je evidentiran u administratorskoj evidenciji.");
  }catch(e){setError(e instanceof Error?e.message:"Greška pri otvaranju razgovora.");}
  finally{setBusy(false);}
 }
 return <section className="space-y-4">
  <div><h2 className="text-xl font-semibold">Privatne poruke korisnika</h2><p className="mt-1 text-sm text-muted-foreground">Pregled razgovora kupaca i prodavaca. Privatnu prepisku otvaraj samo kada postoji opravdan razlog; svaki pristup se beleži.</p></div>
  <div className="rounded-2xl bg-surface p-4 shadow-card space-y-3">
   <label className="block text-sm font-medium">Razlog pregleda ili brisanja (obavezno, najmanje 10 karaktera)
    <textarea className={inputCls+" mt-1 w-full"} rows={2} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Npr. provera prijave korisnika zbog sumnje na prevaru..."/>
   </label>
   <div className="flex flex-wrap items-center gap-2"><div className="w-full max-w-sm"><Input className={inputCls} placeholder="Pretraga po korisniku, e-mailu ili oglasu" value={filter} onChange={e=>setFilter(e.target.value)}/></div><button type="button" className={small} onClick={load} disabled={busy}>Osveži</button><span className="text-xs text-muted-foreground">Razgovora: {rows.length}</span></div>
  </div>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
  <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]">
   <div className="space-y-2">
    {rows.map(row=><button type="button" key={row.id} onClick={()=>openConversation(row)} disabled={busy} className={`w-full rounded-xl border p-3 text-left disabled:opacity-50 ${selected?.id===row.id?"border-brand bg-brand/5":"border-input bg-surface"}`}>
     <p className="text-sm font-semibold">{row.listing_title||"Oglas bez naslova"}</p><p className="mt-1 text-xs text-muted-foreground">{row.listing_type==="ponude"?"Ponuda":"Zahtev"} · {row.message_count} poruka</p>{row.buyer_id===row.seller_id&&<p className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Test razgovor — poruke sebi</p>}
     <p className="mt-2 text-xs">Kupac: {row.buyer_name} <span className="text-muted-foreground">({row.buyer_email})</span></p><p className="text-xs">Prodavac: {row.seller_name} <span className="text-muted-foreground">({row.seller_email})</span></p>
     <p className="mt-1 text-[11px] text-muted-foreground">Poslednja aktivnost: {row.last_message_at?new Date(row.last_message_at).toLocaleString("sr-RS"):new Date(row.updated_at).toLocaleString("sr-RS")}</p>
    </button>)}
    {!busy&&!rows.length&&<p className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">Još nema privatnih razgovora korisnika.</p>}
   </div>
   <div className="min-h-[360px] rounded-2xl border border-input bg-surface p-4">
    {selected?<><div className="flex flex-wrap items-start justify-between gap-3 border-b border-input pb-3"><div><h3 className="font-semibold">{selected.buyer_name} ↔ {selected.seller_name}</h3>{selected.buyer_id===selected.seller_id&&<p className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Test razgovor — poruke sebi</p>}<p className="text-xs text-muted-foreground">{selected.listing_title||"Oglas"} · {selected.listing_type==="ponude"?"Ponuda":"Zahtev"}</p><p className="mt-1 text-[11px] text-muted-foreground">Pregledan razlog: {selectedReason}</p></div><div className="flex flex-wrap gap-2"><button type="button" className={small} onClick={()=>void exportConversation()} disabled={busy}>Izvezi prepisku (.txt)</button><button type="button" className={danger} onClick={()=>void deleteConversation()} disabled={busy}>Obriši ceo razgovor</button></div></div><div className="max-h-[560px] space-y-3 overflow-y-auto py-4">{messages.map(m=><article key={m.id} className="rounded-xl bg-secondary/70 p-3"><div className="mb-1 flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-semibold text-muted-foreground">{m.sender_id===selected.buyer_id?selected.buyer_name:selected.seller_name} · {new Date(m.created_at).toLocaleString("sr-RS")}</p><button type="button" className={danger+" min-h-8 px-2 py-1 text-[11px]"} onClick={()=>void deleteMessage(m)} disabled={busy}>Obriši poruku</button></div><p className="whitespace-pre-wrap break-words text-sm">{m.body}</p></article>)}{!messages.length&&<p className="text-sm text-muted-foreground">Nema poruka u razgovoru.</p>}</div></>:<p className="flex min-h-[320px] items-center justify-center text-center text-sm text-muted-foreground">Izaberi razgovor. Pre otvaranja moraš navesti razlog pregleda.</p>}
   </div>
  </div>
  <section className="space-y-3 rounded-2xl border border-input bg-surface p-4">
   <div><h3 className="font-semibold">Izvezene arhive prepiski</h3><p className="mt-1 text-xs text-muted-foreground">Arhive se čuvaju u bazi PonudiMi. Brisanje ovde uklanja samo serversku arhivu; ranije preuzete kopije na uređajima ostaju.</p></div>
   <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Sačuvanih arhiva: {archives.length}</span><button type="button" className={small} onClick={loadArchives} disabled={busy}>Osveži arhive</button></div>
   <div className="space-y-2">
    {archives.map(archive=><article key={archive.id} className="rounded-xl border border-input p-3">
     <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 text-sm">
       <p className="font-semibold break-words">{archive.listing_title||'Prepiska bez naslova'}</p>
       <p className="mt-1 text-xs text-muted-foreground">{archive.listing_type||'Razgovor'} · {archive.message_count} poruka · {new Date(archive.created_at).toLocaleString('sr-RS')}</p>
       <p className="text-xs text-muted-foreground">Učesnici: {archive.buyer_name||'—'} ↔ {archive.seller_name||'—'}</p>
       <p className="text-xs text-muted-foreground">Izvezao: {archive.created_by_email||'administrator'} · SHA-256: {archive.sha256.slice(0,16)}…</p>
       <p className="mt-1 text-xs text-muted-foreground">Razlog: {archive.export_reason}</p>
      </div>
      <div className="flex flex-wrap gap-2">
       <button type="button" className={small} onClick={()=>void downloadArchive(archive)} disabled={busy}>Preuzmi</button>
       <button type="button" className={danger} onClick={()=>void deleteArchive(archive)} disabled={busy}>Obriši arhivu</button>
      </div>
     </div>
    </article>)}
    {!archives.length&&<p className="rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">Nema sačuvanih arhiva. Sledeći izvoz prepiske biće sačuvan ovde.</p>}
   </div>
  </section>

 </section>;
}
