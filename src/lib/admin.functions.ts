import { ponudimi } from "@/integrations/standalone/client";

async function adminRequest(path: string, method = "POST", body?: unknown) {
  const { data } = await ponudimi.auth.getSession();
  const token = data.session?.access_token;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !isForm ? { "Content-Type": "application/json" } : {}) },
    body: body ? (isForm ? body as FormData : JSON.stringify(body)) : undefined,
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

export async function dodajAdminFotografije({ kind, listingId, files }: { kind: "ponude" | "zahtevi"; listingId: string; files: File[] }) {
  const form = new FormData();
  for (const file of files) form.append("fotografije", file);
  return adminRequest(`/api/admin/listings/${kind}/${encodeURIComponent(listingId)}/images`, "POST", form);
}

export async function obrisiAdminFotografiju(imageId: string) {
  return adminRequest(`/api/admin/images/${encodeURIComponent(imageId)}`, "DELETE");
}

export async function posaljiPredlogIzmene(data: { tabela: "ponude" | "zahtevi"; oglas_id: string; predlozeni_podaci: Record<string, unknown> }) { return adminRequest("/api/moderator/proposals", "POST", data); }
export async function ucitajPredlogeModeratora() { return adminRequest("/api/moderator/proposals", "GET"); }
export async function ucitajAdminPredloge() { return adminRequest("/api/admin/proposals", "GET"); }
export async function odluciOPredlogu(id: string, decision: "odobreno" | "odbijeno", napomena?: string) { return adminRequest("/api/admin/proposals/" + encodeURIComponent(id) + "/decision", "POST", { decision, napomena }); }
