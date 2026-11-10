import { API_ORIGIN, ponudimi } from "@/integrations/standalone/client";

async function adminRequest(path: string, method = "POST", body?: unknown) {
  const { data } = await ponudimi.auth.getSession();
  const token = data.session?.access_token;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(`${API_ORIGIN}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
    },
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
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Dozvoljeni su JPG, PNG ili WebP formati.");
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new Error(`Fotografija "${file.name}" može imati najviše 20 MB.`);
    }
    form.append("fotografije", file);
  }
  return adminRequest(`/api/admin/listings/${kind}/${encodeURIComponent(listingId)}/images`, "POST", form);
}

export async function obrisiAdminFotografiju(imageId: string) {
  return adminRequest(`/api/admin/images/${encodeURIComponent(imageId)}`, "DELETE");
}

export async function posaljiPredlogIzmene(data: { tabela: "ponude" | "zahtevi"; oglas_id: string; predlozeni_podaci: Record<string, unknown> }) {
  return adminRequest("/api/moderator/proposals", "POST", data);
}
export async function ucitajPredlogeModeratora() {
  return adminRequest("/api/moderator/proposals", "GET");
}
export async function ucitajAdminPredloge() {
  return adminRequest("/api/admin/proposals", "GET");
}
export async function odluciOPredlogu(id: string, decision: "odobreno" | "odbijeno", napomena?: string) {
  return adminRequest(`/api/admin/proposals/${encodeURIComponent(id)}/decision`, "POST", { decision, napomena });
}

export async function ucitajAdminStatistiku() {
  return adminRequest("/api/admin/stats", "GET");
}

export type FirmaZaPaket = { user_id:string; naziv_firme:string|null; pib:string|null; email:string|null; telefon:string|null; firma_verifikovana:boolean };
export type PaketFirme = { id:string; user_id:string; paket:string; cena_eur:number; status:string; status_uplate:string; vazi_od:string; vazi_do:string; napomena:string|null; referenca_uplate:string|null; email_podsetnik_poslat_at:string|null; email_podsetnik_greska:string|null; naziv_firme:string|null; pib:string|null; email:string|null; telefon:string|null; firma_verifikovana:boolean };
export async function pretraziFirmeZaPaket(q:string){return adminRequest(`/api/admin/business-firms?q=${encodeURIComponent(q)}`,"GET") as Promise<{data:FirmaZaPaket[]}>;}
export async function ucitajPaketeFirmi(){return adminRequest("/api/admin/business-packages","GET") as Promise<{data:PaketFirme[]}>;}
export async function dodeliPaketFirmi(data:{user_id:string;paket:string;status_uplate:string;napomena?:string;referenca_uplate?:string}){return adminRequest("/api/admin/business-packages","POST",data);}
export async function otkaziPaketFirme(id:string){return adminRequest(`/api/admin/business-packages/${encodeURIComponent(id)}/cancel`,"POST",{});}

export type KatalogPaket = {slug:string;naziv:string;cena_eur:number;trajanje_meseci:number;opis:string;pogodnosti:string[];objavljen:boolean;pozicija:number};
export async function ucitajKatalogPaketa(){return adminRequest("/api/admin/business-package-catalog","GET") as Promise<{data:KatalogPaket[]}>;}
export async function sacuvajKatalogPaketa(packages:KatalogPaket[]){return adminRequest("/api/admin/business-package-catalog","PUT",{packages});}

 
export async function pretraziKorisnikeZaPaket(q:string){return adminRequest(`/api/admin/access-grants/users?q=${encodeURIComponent(q)}`,"GET") as Promise<{data:any[]}>;}
export async function ucitajAdminDodelePaketa(){return adminRequest("/api/admin/access-grants","GET") as Promise<{data:any[]}>;}
export async function dodeliPaketKorisniku(data:{user_id:string;package_name:string;duration_days:number;gratis:boolean;cena_eur:number;napomena?:string}){return adminRequest("/api/admin/access-grants","POST",data);}
export async function otkaziDodeluPaketa(id:string){return adminRequest(`/api/admin/access-grants/${encodeURIComponent(id)}/cancel`,"POST",{});}
