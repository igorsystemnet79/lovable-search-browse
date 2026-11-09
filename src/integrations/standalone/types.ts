export type ProfileRow = {
  id: string;
  ime: string | null;
  prezime: string | null;
  korisnicko_ime: string | null;
  telefon_normalizovan?: string | null;
  telefon_verifikovan_at?: string | null;
  email_confirmed_at?: string | null;
  duplikat_sumnja?: boolean;
  verifikacija_zapoceta_at?: string | null;
  telefon: string | null;
  grad: string | null;
  adresa: string | null;
  tip_lica: string;
  naziv_firme: string | null;
  pib: string | null;
  firma_verifikovana: boolean;
  blokiran: boolean;
  email: string | null;
  created_at: string;
  last_active_at: string | null;
};

export type SupportMessageRow = {
  id: string;
  ime: string;
  email: string;
  poruka: string;
  created_at: string;
};

export type AprFirmRow = {
  pib: string;
  maticni_broj: string | null;
  naziv: string;
  sediste: string | null;
  adresa: string | null;
  status: string | null;
  synced_at: string;
};

export type AprSyncRow = {
  id: string;
  pokrenuo: string | null;
  broj_firmi: number;
  uspeh: boolean;
  poruka: string | null;
  created_at: string;
};

export type BusinessPackageRow = {
  id: string;
  user_id: string;
  paket: "mesecni" | "tromesecni" | "sestomesecni" | "godisnji";
  cena_eur: number;
  status: "na_cekanju" | "aktivan" | "istekao" | "otkazan";
  status_uplate: "ceka_uplatu" | "placeno" | "oslobodjeno";
  vazi_od: string;
  vazi_do: string;
  napomena: string | null;
  referenca_uplate: string | null;
  kreirao_id: string | null;
  email_podsetnik_poslat_at: string | null;
  email_podsetnik_greska: string | null;
  created_at: string;
  updated_at: string;
};

export type Tables<Name extends "profiles" | "poruke_podrske" | "apr_firme" | "apr_sinhronizacije" | "paketi_firmi"> =
  Name extends "profiles" ? ProfileRow :
  Name extends "poruke_podrske" ? SupportMessageRow :
  Name extends "apr_firme" ? AprFirmRow : Name extends "apr_sinhronizacije" ? AprSyncRow : BusinessPackageRow;
