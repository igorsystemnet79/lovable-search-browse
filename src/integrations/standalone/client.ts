/* PonudiMi standalone client compatibility layer.
 * Keeps the existing application call sites while using the self-hosted API.
 */
import { kategorije as podrazumevaneKategorije, type Kategorija } from "@/lib/kategorije";
const configuredApiOrigin = (import.meta as any).env?.VITE_API_ORIGIN;
const sameOriginApi = configuredApiOrigin === "same-origin";
export const API_ORIGIN = String(
  configuredApiOrigin && !sameOriginApi
    ? configuredApiOrigin
    : typeof window !== "undefined"
      ? (sameOriginApi ? window.location.origin : "https://ponudimi-test-api.onrender.com")
      : process.env.PUBLIC_APP_URL || "http://localhost"
).replace(/\/+$/, "");
const SESSION_KEY = "ponudimi_session";
type AnyRecord = Record<string, any>;

function readSession(): any {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
function writeSession(session: any) {
  if (typeof window !== "undefined") {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  }
}
const listeners = new Set<(event: string, session: any) => void>();
function emit(event: string, session: any) { for (const listener of listeners) listener(event, session); }
// Render Free may suspend the API while idle. Share one short wake-up
// check across concurrent requests so login and homepage listings recover
// together instead of each request waiting through its own retry loop.
let apiReadyUntil = 0;
let apiReadyPromise: Promise<void> | null = null;

async function ensureApiReady(): Promise<void> {
  if (Date.now() < apiReadyUntil) return;
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const apiOrigin = typeof window === "undefined"
          ? (process.env.API_INTERNAL_URL || API_ORIGIN)
          : API_ORIGIN;
        const healthTarget = `${apiOrigin}/api/health`;
        const response = await fetch(healthTarget, {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        if (response.ok) {
          const health = await response.json().catch(() => null);
          if (health?.ok && health?.database === "connected") {
            apiReadyUntil = Date.now() + 45_000;
            return;
          }
          lastError = new Error("API nije potvrdio vezu sa bazom.");
        } else {
          const error = Object.assign(
            new Error(`Servis za naloge nije spreman (HTTP ${response.status}).`),
            { status: response.status },
          );
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw Object.assign(error, { fatal: true });
          }
          lastError = error;
        }
      } catch (error: any) {
        if (error?.fatal) throw error;
        lastError = error;
      }
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw Object.assign(
      new Error("Servis trenutno ne odgovara ili ne može da se poveže sa bazom. Pokušaj ponovo za minut."),
      { status: 503, code: "API_STARTUP_TIMEOUT", cause: lastError },
    );
  })();

  try {
    await apiReadyPromise;
  } finally {
    apiReadyPromise = null;
  }
}

async function api(path: string, init: RequestInit = {}) {
  await ensureApiReady();
  const session = readSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  if (!(init.body instanceof FormData) && init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const apiOrigin = typeof window === "undefined"
    ? (process.env.API_INTERNAL_URL || API_ORIGIN)
    : API_ORIGIN;
  const target = `${apiOrigin}${path}`;
  const response = await fetch(target, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || `Greška servera (${response.status})`), { status: response.status, code: body.code });
  return body;
}

class QueryBuilder implements PromiseLike<any> {
  private action = "select";
  private columns = "*";
  private values: any;
  private filters: Array<{ op: string; column: string; value: any }> = [];
  private disjunction: string | null = null;
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private rowLimit?: number;
  private rowOffset = 0;
  private one = false;
  private includePaused = false;
  private countMode?: string;
  constructor(private table: string) {}
  select(columns = "*", options?: any) { this.columns = columns; this.countMode = options?.count; return this; }
  eq(column: string, value: any) { this.filters.push({ op: "eq", column, value }); return this; }
  ilike(column: string, value: string) { this.filters.push({ op: "ilike", column, value }); return this; }
  or(expression: string) { this.disjunction = expression; return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orders.push({ column, ascending: options?.ascending !== false }); return this; }
  limit(value: number) { this.rowLimit = value; return this; }
  range(from: number, to: number) { this.rowOffset = Math.max(0, Math.trunc(from)); this.rowLimit = Math.max(0, Math.trunc(to) - this.rowOffset + 1); return this; }
  insert(values: any) { this.action = "insert"; this.values = values; return this; }
  upsert(values: any) { this.action = "upsert"; this.values = values; return this; }
  update(values: any) { this.action = "update"; this.values = values; return this; }
  delete() { this.action = "delete"; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  includePausedListings() { this.includePaused = true; return this; }
  then<TResult1 = any, TResult2 = never>(onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    const run = async () => {
      try {
        const result = await api("/api/db/query", { method: "POST", body: JSON.stringify({ table: this.table, action: this.action, columns: this.columns, values: this.values, filters: this.filters, or: this.disjunction, orders: this.orders, limit: this.rowLimit, offset: this.rowOffset, single: this.one, count: this.countMode, includePaused: this.includePaused }) });
        return { data: result.data ?? null, error: null, count: result.count ?? null };
      } catch (error: any) { return { data: null, error: { message: error.message || "Greška", code: error.code }, count: null }; }
    };
    return run().then(onfulfilled, onrejected);
  }
}

const auth = {
  async signUp({ email, password, options }: any) {
    try {
      await ensureApiReady();
      const result = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, metadata: options?.data || {} }) });
      if (result.session) { writeSession(result.session); emit("SIGNED_IN", result.session); }
      return { data: { user: result.user || null, session: result.session || null, pending_verification: false, email: result.email }, error: null };
    } catch (error: any) { return { data: { user: null, session: null }, error }; }
  },
  async signInWithPassword({ email, password }: any) {
    try {
      await ensureApiReady();
      const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (result.verification_required) return { data: result, error: Object.assign(new Error(result.message || "Potrebna je potvrda telefona."), { verificationToken: result.verification_token }) };
      writeSession(result.session);
      emit("SIGNED_IN", result.session);
      return { data: result, error: null };
    } catch (error: any) { return { data: { user: null, session: null }, error }; }
  },
  async getSession() {
    const session = readSession();
    if (!session?.access_token) return { data: { session: null }, error: null };

    try {
      const result = await api("/api/auth/me");
      const next = { ...session, user: result.user };
      writeSession(next);
      return { data: { session: next }, error: null };
    } catch (error: any) {
      // A sleeping/unavailable API or a temporary 5xx must never erase a
      // still-stored login. Clear the token only when the API explicitly
      // confirms that it is invalid, expired, or the account is blocked.
      if (error?.status === 401 || error?.status === 403) {
        writeSession(null);
        return { data: { session: null }, error };
      }

      return {
        data: { session },
        error: {
          message: error?.message || "Provera sesije trenutno nije dostupna.",
          status: error?.status,
          code: error?.code,
        },
      };
    }
  },
  onAuthStateChange(callback: (event: string, session: any) => void) {
    listeners.add(callback); const subscription = { unsubscribe: () => { listeners.delete(callback); } };
    return { data: { subscription } };
  },
  async signOut() { writeSession(null); emit("SIGNED_OUT", null); return { error: null }; },
  async setSession(tokens: any) { const session = { access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_type: "bearer", user: tokens.user || null }; writeSession(session); emit("SIGNED_IN", session); return { data: { session }, error: null }; },
  async getClaims(token?: string) { try { const result = await api("/api/auth/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} }); return { data: { claims: { sub: result.user.id, email: result.user.email } }, error: null }; } catch (error: any) { return { data: { claims: null }, error }; } },
  async resetPasswordForEmail(email: string, options?: any) { try { await api("/api/auth/reset-request", { method: "POST", body: JSON.stringify({ email, redirectTo: options?.redirectTo }) }); return { data: {}, error: null }; } catch (error: any) { return { data: {}, error }; } },
  async updateUser(attributes: any) { try {
    const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
    if (token) { const result = await api("/api/auth/reset-complete", { method: "POST", body: JSON.stringify({ token, password: attributes.password }) }); if (result.session) { writeSession(result.session); emit("SIGNED_IN", result.session); } }
    else await api("/api/auth/password", { method: "PATCH", body: JSON.stringify(attributes) });
    return { data: { user: readSession()?.user }, error: null };
  } catch (error: any) { return { data: { user: null }, error }; } },
};

const storage = {
  from(bucket: string) {
    return {
      getPublicUrl(path: string) { const key = path.split("/").filter(Boolean).filter((part, index) => !(index === 0 && part === "uploads")).join("/"); return { data: { publicUrl: `${API_ORIGIN}/api/storage/public?path=${encodeURIComponent(key)}` } }; },
      async upload(path: string, file: File, options?: any) {
        try { const form = new FormData(); form.append("file", file); form.append("path", path); form.append("bucket", bucket); form.append("contentType", options?.contentType || file.type); await api("/api/storage/upload", { method: "POST", body: form }); return { data: { path }, error: null }; }
        catch (error: any) { return { data: null, error }; }
      },
      async remove(paths: string[]) { try { await api("/api/storage/remove", { method: "POST", body: JSON.stringify({ bucket, paths }) }); return { data: paths.map(name => ({ name })), error: null }; } catch (error: any) { return { data: null, error }; } },
    };
  },
};

// Google Authenticator administracija je privremeno isključena.
// Zadržavamo kompatibilan objekat da stariji pozivi ne obore učitavanje aplikacije.
const adminSecurity = {
  async status() { return { enabled: false, temporarily_disabled: true }; },
  async setup() { throw new Error("Google Authenticator je privremeno isključen."); },
  async verifySetup() { throw new Error("Google Authenticator je privremeno isključen."); },
  async challenge() { throw new Error("Google Authenticator je privremeno isključen."); },
};

const verification = {
  async confirmEmail(token: string) { return api("/api/auth/email/confirm", { method: "POST", body: JSON.stringify({ token }) }); },
  async startPhone(verificationToken: string) { return api("/api/auth/phone/start", { method: "POST", body: JSON.stringify({ verification_token: verificationToken }) }); },
  async checkPhone(verificationToken: string, code: string) { return api("/api/auth/phone/check", { method: "POST", body: JSON.stringify({ verification_token: verificationToken, code }) }); },
};

export const ponudimi: any = {
  auth,
  verification,
  adminSecurity,
  storage,
  from: (table: string) => new QueryBuilder(table),
  async rpc(fn: string, args: AnyRecord = {}) { try { const result = await api("/api/db/rpc", { method: "POST", body: JSON.stringify({ fn, args }) }); return { data: result.data, error: null }; } catch (error: any) { return { data: null, error }; } },
};


export async function ucitajKategorije(): Promise<Kategorija[]> {
 const response=await api("/api/categories"),additions=Array.isArray(response.data)?response.data as Partial<Kategorija>[]:[];
 const merged=podrazumevaneKategorije.map(base=>{const extra=additions.find(item=>item.slug===base.slug);return extra?{...base,...extra,slika:extra.slika||base.slika,fotoAutor:extra.fotoAutor||base.fotoAutor,fotoIzvor:extra.fotoIzvor||base.fotoIzvor,podkategorije:[...new Set([...base.podkategorije,...(extra.podkategorije||[])])]}:base;});
 for(const extra of additions)if(extra.slug&&!merged.some(item=>item.slug===extra.slug))merged.push({slug:extra.slug,naziv:extra.naziv||extra.slug,slika:extra.slika||podrazumevaneKategorije[0]?.slika||"",fotoAutor:extra.fotoAutor||"",fotoIzvor:extra.fotoIzvor||"",podkategorije:extra.podkategorije||[]});
 return merged;
}
export async function dodajKategoriju(naziv:string){return api("/api/admin/categories",{method:"POST",body:JSON.stringify({naziv})});}
export async function dodajPotkategoriju(slug:string,naziv:string,grupa:string){return api(`/api/admin/categories/${encodeURIComponent(slug)}/subcategories`,{method:"POST",body:JSON.stringify({naziv,grupa})});}
export async function ucitajPravilaPlatforme() {
  // Sprečava da pregledač ili posredni keš vrati staru verziju javno objavljenih pravila.
  return api(`/api/platform-rules?refresh=${Date.now()}`);
}

export async function sacuvajPravilaPlatforme(sadrzaj: string) {
  return api("/api/admin/platform-rules", { method: "PUT", body: JSON.stringify({ sadrzaj }) });
}

export async function ucitajIstorijuPravilaPlatforme() {
  return api("/api/admin/platform-rules/history");
}

export async function vratiVerzijuPravilaPlatforme(id: string) {
  return api("/api/admin/platform-rules/restore", { method: "POST", body: JSON.stringify({ id }) });
}


export async function sinhronizujFotografijeOglasa(id: string, kind: "ponuda" | "zahtev", form: FormData) {
  form.set("tip", kind);
  return api(`/api/oglasi/${encodeURIComponent(id)}/slike`, { method: "PUT", body: form });
}

export async function posaljiSignalPrisustva() {
  return api("/api/presence/heartbeat", { method: "POST" });
}

export async function ucitajKorisnikeNaMrezi() {
  return api("/api/presence/online");
}

export async function ucitajRezimOdrzavanja() {
  return api("/api/maintenance-status");
}

export async function podesiRezimOdrzavanja(enabled: boolean, message?: string) {
  return api("/api/admin/maintenance-mode", { method: "PUT", body: JSON.stringify({ enabled, message }) });
}
