import { ponudimi } from "@/integrations/standalone/client";

// Administratorske rute su na zasebnom Render API servisu, ne na frontend hostu.
const API_ORIGIN = "https://ponudimi-test-api.onrender.com";

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

async function pripremiAdminFotografiju(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Dozvoljeni su JPG, PNG ili WebP formati.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Fotografija "${file.name}" ne može da se otvori ili je oštećena.`);
  }

  try {
    const { width, height } = bitmap;
    if (!width || !height || Math.min(width, height) < 240 || Math.max(width, height) > 12000 || width * height > 40_000_000) {
      throw new Error(`Fotografija "${file.name}" mora imati najmanje 240 px po kraćoj stranici i najviše 40 megapiksela.`);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Obrada fotografije nije uspela.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 800, 600);
    const scale = Math.min(800 / width, 600 / height);
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);
    context.drawImage(bitmap, Math.round((800 - targetWidth) / 2), Math.round((600 - targetHeight) / 2), targetWidth, targetHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Ne mogu da obradim fotografiju.")), "image/jpeg", 0.86);
    });
    return new File([blob], file.name.replace(/\\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export async function dodajAdminFotografije({ kind, listingId, files }: { kind: "ponude" | "zahtevi"; listingId: string; files: File[] }) {
  const form = new FormData();
  for (const file of await Promise.all(files.map(pripremiAdminFotografiju))) {
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
