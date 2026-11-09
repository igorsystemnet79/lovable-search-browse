import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Settings2, X } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ponudimi } from "@/integrations/standalone/client";
import logo from "@/assets/ponudimi-logo.png";

const outline =
  "rounded-full border border-brand-foreground/25 px-4 py-2 font-medium transition-colors hover:bg-brand-foreground/10";
const solid =
  "rounded-full bg-highlight px-4 py-2 font-semibold text-highlight-foreground transition-opacity hover:opacity-90";


type UserNotification = {
  id: string; type: string; title: string; message: string;
  link: string | null; read_at: string | null; created_at: string;
};
type NotificationPreferences = {
  in_app_enabled: boolean; listing_updates: boolean; important_changes: boolean; new_offers: boolean; new_requests: boolean;
};

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    in_app_enabled: true, listing_updates: true, important_changes: true, new_offers: false, new_requests: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const token = () => {
    try { return JSON.parse(localStorage.getItem("ponudimi_session") || "null")?.access_token || ""; }
    catch { return ""; }
  };
  const headers = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?limit=30", { cache: "no-store", headers: headers() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Obaveštenja trenutno nisu dostupna.");
      setItems(data.data || []); setUnread(Number(data.unread || 0)); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Greška pri učitavanju obaveštenja."); }
  }, []);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 45000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function markRead(id: string) {
    const response = await fetch(`/api/notifications/${id}/read`, { method: "PATCH", headers: headers() });
    if (response.ok) { setItems(rows => rows.map(row => row.id === id ? { ...row, read_at: new Date().toISOString() } : row)); setUnread(value => Math.max(0, value - 1)); }
  }
  async function markAllRead() {
    setBusy(true);
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST", headers: headers() });
      if (!response.ok) throw new Error("Nije moguće označiti obaveštenja kao pročitana.");
      setItems(rows => rows.map(row => ({ ...row, read_at: row.read_at || new Date().toISOString() })));
      setUnread(0);
    } catch (e) { setError(e instanceof Error ? e.message : "Greška."); }
    finally { setBusy(false); }
  }
  async function loadPreferences() {
    const response = await fetch("/api/notifications/preferences", { cache: "no-store", headers: headers() });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.data) setPreferences({
      in_app_enabled: !!data.data.in_app_enabled,
      listing_updates: !!data.data.listing_updates,
      important_changes: !!data.data.important_changes,
      new_offers: !!data.data.new_offers,
      new_requests: !!data.data.new_requests,
    });
  }
  async function savePreferences(next: NotificationPreferences) {
    setPreferences(next);
    const response = await fetch("/api/notifications/preferences", {
      method: "PUT", headers: headers(), body: JSON.stringify({ ...next, email_enabled: false }),
    });
    if (!response.ok) { setError("Podešavanja nisu sačuvana."); await loadPreferences(); }
  }
  return (
    <div className="relative">
      <button type="button" className={outline + " relative inline-flex items-center gap-2"} aria-label="Obaveštenja" aria-expanded={open} onClick={() => { setOpen(value => !value); if (!open) load(); }}>
        <Bell className="h-4 w-4" /> Obaveštenja
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-highlight px-1 text-center text-[10px] font-bold leading-5 text-highlight-foreground">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-input bg-surface text-foreground shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-input p-3">
            <div><p className="font-semibold">Obaveštenja</p><p className="text-xs text-muted-foreground">{unread} nepročitanih</p></div>
            <div className="flex items-center gap-1">
              <button type="button" className="rounded-full p-2 hover:bg-secondary" title="Podešavanja" onClick={async () => { setSettingsOpen(v => !v); await loadPreferences(); }}><Settings2 className="h-4 w-4" /></button>
              <button type="button" className="rounded-full p-2 hover:bg-secondary" aria-label="Zatvori" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
          </div>
          {settingsOpen ? (
            <div className="space-y-3 p-4 text-sm">
              <p className="font-semibold">Podešavanja obaveštenja</p>
              {([
                ["in_app_enabled", "Obaveštenja u platformi"],
                ["listing_updates", "Izmene oglasa koje pratim"],
                ["important_changes", "Važna obaveštenja platforme"],
                ["new_offers", "Nove ponude"],
                ["new_requests", "Novi zahtevi"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3">
                  <span>{label}</span>
                  <input type="checkbox" checked={preferences[key]} onChange={e => savePreferences({ ...preferences, [key]: e.target.checked })} />
                </label>
              ))}
              <button type="button" className={outline + " text-foreground"} onClick={() => setSettingsOpen(false)}>Nazad na obaveštenja</button>
            </div>
          ) : (
            <>
              {unread > 0 && <div className="flex justify-end border-b border-input px-3 py-2"><button type="button" disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline disabled:opacity-50" onClick={markAllRead}><CheckCheck className="h-3.5 w-3.5" /> Označi sve kao pročitano</button></div>}
              <div className="max-h-[min(65vh,480px)] overflow-y-auto">
                {error && <p role="alert" className="p-3 text-sm text-destructive">{error}</p>}
                {items.map(item => (
                  <div key={item.id} className={`border-b border-input p-3 ${item.read_at ? "opacity-70" : "bg-brand/5"}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? "bg-muted-foreground/30" : "bg-highlight"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-sm">{item.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("sr-RS")}</p>
                        {item.link === "/praceni-oglasi" && <button type="button" className="mt-2 text-xs font-semibold text-brand hover:underline" onClick={async () => { if (!item.read_at) await markRead(item.id); setOpen(false); window.location.href = "/praceni-oglasi"; }}>Otvori praćene oglase</button>}
                      </div>
                      {!item.read_at && <button type="button" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary" title="Označi kao pročitano" onClick={() => markRead(item.id)}><CheckCheck className="h-4 w-4" /></button>}
                    </div>
                  </div>
                ))}
                {!items.length && !error && <p className="p-6 text-center text-sm text-muted-foreground">Trenutno nema obaveštenja.</p>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  const { user, isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 bg-brand text-brand-foreground">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-4">
        <Link to="/" aria-label="PonudiMi — početna" className="flex h-10 w-32 shrink-0 items-center justify-center rounded-md bg-surface">
          <img src={logo} alt="PonudiMi" width={707} height={353} className="h-12 w-32 object-contain" />
        </Link>

        <nav aria-label="Korisničke opcije" className="flex flex-wrap items-center gap-2 text-sm">
          <Link to="/podrska" className={outline}>
            Podrška
          </Link>
          {user ? (
            <>
              {isAdmin && <Link to="/admin" className={outline}>Admin</Link>}
              <Link to="/moji-oglasi" className={outline}>Moji oglasi</Link>
              <Link to="/praceni-oglasi" className={outline}>Prati oglase</Link>
              <NotificationsBell />
              <span className="hidden px-2 text-brand-foreground/80 sm:inline">
                {(user.user_metadata?.["ime"] as string) || user.email}
              </span>
              <button
                type="button"
                className={solid}
                onClick={async () => {
                  await ponudimi.auth.signOut();
                  navigate({ to: "/" });
                }}
              >
                Odjava
              </button>
            </>
          ) : (
            <>
              <Link to="/prijava" className={outline}>
                Prijava
              </Link>
              <Link to="/registracija" className={solid}>
                Registracija
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
