/* PonudiMi standalone client compatibility layer.
 * Keeps the existing application call sites while using the self-hosted API.
 */
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
async function api(path: string, init: RequestInit = {}) {
  const session = readSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  if (!(init.body instanceof FormData) && init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const target = typeof window === "undefined" ? `${process.env.API_INTERNAL_URL || "http://127.0.0.1:4000"}${path}` : path;
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
  private one = false;
  private countMode?: string;
  constructor(private table: string) {}
  select(columns = "*", options?: any) { this.columns = columns; this.countMode = options?.count; return this; }
  eq(column: string, value: any) { this.filters.push({ op: "eq", column, value }); return this; }
  ilike(column: string, value: string) { this.filters.push({ op: "ilike", column, value }); return this; }
  or(expression: string) { this.disjunction = expression; return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orders.push({ column, ascending: options?.ascending !== false }); return this; }
  limit(value: number) { this.rowLimit = value; return this; }
  insert(values: any) { this.action = "insert"; this.values = values; return this; }
  upsert(values: any) { this.action = "upsert"; this.values = values; return this; }
  update(values: any) { this.action = "update"; this.values = values; return this; }
  delete() { this.action = "delete"; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  then<TResult1 = any, TResult2 = never>(onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    const run = async () => {
      try {
        const result = await api("/api/db/query", { method: "POST", body: JSON.stringify({ table: this.table, action: this.action, columns: this.columns, values: this.values, filters: this.filters, or: this.disjunction, orders: this.orders, limit: this.rowLimit, single: this.one, count: this.countMode }) });
        return { data: result.data ?? null, error: null, count: result.count ?? null };
      } catch (error: any) { return { data: null, error: { message: error.message || "Greška", code: error.code }, count: null }; }
    };
    return run().then(onfulfilled, onrejected);
  }
}

const auth = {
  async signUp({ email, password, options }: any) {
    try { const result = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, metadata: options?.data || {} }) }); return { data: { user: result.user, session: null }, error: null }; }
    catch (error: any) { return { data: { user: null, session: null }, error }; }
  },
  async signInWithPassword({ email, password }: any) {
    try { const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); writeSession(result.session); emit("SIGNED_IN", result.session); return { data: result, error: null }; }
    catch (error: any) { return { data: { user: null, session: null }, error }; }
  },
  async getSession() {
    const session = readSession();
    if (!session?.access_token) return { data: { session: null }, error: null };
    try { const result = await api("/api/auth/me"); const next = { ...session, user: result.user }; writeSession(next); return { data: { session: next }, error: null }; }
    catch { writeSession(null); return { data: { session: null }, error: null }; }
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
      getPublicUrl(path: string) { const key = path.split("/").filter(Boolean).filter((part, index) => !(index === 0 && part === "uploads")).join("/"); return { data: { publicUrl: `/api/storage/public?path=${encodeURIComponent(key)}` } }; },
      async upload(path: string, file: File, options?: any) {
        try { const form = new FormData(); form.append("file", file); form.append("path", path); form.append("bucket", bucket); form.append("contentType", options?.contentType || file.type); await api("/api/storage/upload", { method: "POST", body: form }); return { data: { path }, error: null }; }
        catch (error: any) { return { data: null, error }; }
      },
      async remove(paths: string[]) { try { await api("/api/storage/remove", { method: "POST", body: JSON.stringify({ bucket, paths }) }); return { data: paths.map(name => ({ name })), error: null }; } catch (error: any) { return { data: null, error }; } },
    };
  },
};

export const ponudimi: any = {
  auth,
  storage,
  from: (table: string) => new QueryBuilder(table),
  async rpc(fn: string, args: AnyRecord = {}) { try { const result = await api("/api/db/rpc", { method: "POST", body: JSON.stringify({ fn, args }) }); return { data: result.data, error: null }; } catch (error: any) { return { data: null, error }; } },
};
