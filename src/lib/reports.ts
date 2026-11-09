import { API_ORIGIN, ponudimi } from "@/integrations/standalone/client";

export type PrijavaOglasa = {
  id: string;
  tabela: "ponude" | "zahtevi";
  oglas_id: string;
  prijavio_id: string | null;
  razlog: string;
  detalji: string | null;
  status: "na_cekanju" | "pregledano" | "odbijeno" | "oglas_uklonjen" | "vracen_u_prikaz";
  admin_napomena: string | null;
  created_at: string;
  odluceno_at: string | null;
  oglas_naslov: string | null;
  oglas_lokacija: string | null;
  vlasnik_email: string | null;
  prijavio_email: string | null;
};

async function request(path: string, method = "GET", body?: unknown) {
  const { data } = await ponudimi.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(`${API_ORIGIN}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Operacija nije uspela.");
  return result;
}

export async function prijaviOglas(data: {
  tabela: "ponude" | "zahtevi";
  oglas_id: string;
  razlog: string;
  detalji?: string;
}) {
  return request("/api/reports", "POST", data);
}

export async function ucitajPrijaveOglasa(): Promise<PrijavaOglasa[]> {
  return request("/api/admin/reports");
}

export async function obradiPrijavu(id: string, status: "pregledano" | "odbijeno" | "oglas_uklonjen" | "vracen_u_prikaz", napomena?: string) {
  return request(`/api/admin/reports/${encodeURIComponent(id)}/decision`, "POST", { status, napomena });
}
