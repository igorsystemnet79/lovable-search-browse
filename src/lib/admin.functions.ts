import { ponudimi } from "@/integrations/standalone/client";

async function adminRequest(path: string, method = "POST", body?: unknown) {
  const { data } = await ponudimi.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
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

export async function adminStatistika() {
  return adminRequest("/api/admin/stats", "GET");
}
export async function adminPrijaveOglasa() {
  return adminRequest("/api/admin/reports", "GET");
}
export async function odluciPrijavuOglasa(id: string, status: "pregledano" | "odbijeno", napomena = "") {
  return adminRequest(`/api/admin/reports/${encodeURIComponent(id)}/decision`, "POST", { status, napomena });
}
export async function prijaviOglas(tabela: "ponude" | "zahtevi", oglas_id: string, razlog: string, detalji = "") {
  return adminRequest("/api/reports", "POST", { tabela, oglas_id, razlog, detalji });
}
