import { ponudimi } from "@/integrations/standalone/client";

async function adminRequest(path: string, method = "POST", body?: unknown) {
  const { data } = await ponudimi.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(token ? { Authorization: `Bearer ${token}` } : {});
  const serializedBody = body === undefined ? undefined : JSON.stringify(body);
  if (serializedBody !== undefined) headers.set("Content-Type", "application/json");
  const init: RequestInit = { method, headers };
  if (serializedBody !== undefined) init.body = serializedBody;
  const response = await fetch(path, init);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Administratorska operacija nije uspela.");
  return result;
}

export async function obrisiKorisnika({ data }: { data: { userId: string } }) {
  return adminRequest(`/api/admin/users/${encodeURIComponent(data.userId)}`, "DELETE");
}

export async function sinhronizujApr() {
  return adminRequest("/api/admin/apr-sync", "POST");
}
