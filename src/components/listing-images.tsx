import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type ListingPhoto = {
  id?: string;
  preview: string;
  file?: File;
  externalUrl?: string;
  storagePath?: string;
};

const MAX_PHOTOS = 7;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function resizeImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Dozvoljeni su JPG, PNG i WEBP formati.");
  }
  if (file.size > MAX_FILE_BYTES) throw new Error("Fotografija ne sme biti veća od 10 MB.");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Obrada fotografije nije uspela.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 800, 600);
  const scale = Math.min(800 / bitmap.width, 600 / bitmap.height);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  ctx.drawImage(bitmap, Math.round((800 - width) / 2), Math.round((600 - height) / 2), width, height);
  bitmap.close();
  return await new Promise((resolve, reject) =>
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Ne mogu da obradim fotografiju.")), "image/jpeg", 0.86)
  );
}

export function ListingImages({
  value,
  onChange,
  disabled = false,
}: {
  value: ListingPhoto[];
  onChange: (photos: ListingPhoto[]) => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (value.length + selected.length > MAX_PHOTOS) {
      setError("Možeš dodati najviše 7 fotografija po objavi.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next: ListingPhoto[] = [];
      for (const file of selected) {
        const blob = await resizeImage(file);
        const preview = URL.createObjectURL(blob);
        next.push({ file: new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }), preview });
      }
      onChange([...value, ...next]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotografija nije mogla da se učita.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function addUrl() {
    const candidate = url.trim();
    if (!candidate) return;
    if (value.length >= MAX_PHOTOS) { setError("Možeš dodati najviše 7 fotografija po objavi."); return; }
    let parsed: URL;
    try { parsed = new URL(candidate); } catch { setError("Unesi ispravnu internet adresu fotografije."); return; }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") { setError("Dozvoljene su samo HTTP/HTTPS adrese."); return; }
    setBusy(true);
    setError("");
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Adresa ne vodi direktno do dostupne fotografije."));
        img.src = candidate;
      });
      onChange([...value, { preview: candidate, externalUrl: candidate }]);
      setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotografija sa interneta nije dostupna.");
    } finally { setBusy(false); }
  }

  function remove(index: number) {
    const photo = value[index];
    if (photo?.file && photo.preview.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
    onChange(value.filter((_, i) => i !== index));
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  useEffect(() => () => {
    value.forEach((photo) => { if (photo.file && photo.preview.startsWith("blob:")) URL.revokeObjectURL(photo.preview); });
  }, []);

  return (
    <section className="space-y-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Fotografije</p>
          <p className="text-xs text-muted-foreground">Do 7 slika · automatski format 800 × 600 px</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{value.length}/7</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void addFiles(e.target.files)} disabled={disabled || busy || value.length >= MAX_PHOTOS} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={disabled || busy || value.length >= MAX_PHOTOS} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50">
          <ImagePlus className="h-4 w-4" /> Izaberi sa uređaja
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Nalepi direktnu adresu fotografije (https://...)" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" disabled={disabled || busy || value.length >= MAX_PHOTOS} />
        <button type="button" onClick={() => void addUrl()} disabled={disabled || busy || !url.trim() || value.length >= MAX_PHOTOS} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50">
          <Link2 className="h-4 w-4" /> Dodaj URL
        </button>
      </div>
      {busy && <p className="text-xs text-muted-foreground">Obrađujem fotografije…</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {value.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {value.map((photo, index) => <div key={photo.id ?? photo.preview} className="relative overflow-hidden rounded-lg border border-border bg-secondary">
          <img src={photo.preview} alt={`Fotografija ${index + 1}`} className="aspect-[4/3] w-full object-contain" />
          <span className="absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-xs text-white">{index + 1}</span>
          <div className="absolute right-1 top-1 flex gap-1">
            <button type="button" aria-label="Pomeri ulevo" onClick={() => move(index, -1)} disabled={index === 0 || disabled} className="rounded bg-black/65 p-1 text-white disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Pomeri udesno" onClick={() => move(index, 1)} disabled={index === value.length - 1 || disabled} className="rounded bg-black/65 p-1 text-white disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" aria-label="Ukloni fotografiju" onClick={() => remove(index)} disabled={disabled} className="rounded bg-destructive p-1 text-white"><X className="h-4 w-4" /></button>
          </div>
        </div>)}
      </div>}
    </section>
  );
}

export async function ucitajSlikeOglasa(kind: "ponuda" | "zahtev", id: string): Promise<ListingPhoto[]> {
  const column = kind === "ponuda" ? "ponuda_id" : "zahtev_id";
  const { data, error } = await supabase.from("slike_oglasa").select("*").eq(column, id).order("pozicija");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const path = row.storage_path as string | null;
    const external = row.external_url as string | null;
    const preview = external ?? (path ? supabase.storage.from("slike-oglasa").getPublicUrl(path).data.publicUrl : "");
    return { id: row.id as string, preview, externalUrl: external ?? undefined, storagePath: path ?? undefined };
  });
}

export async function sacuvajSlikeOglasa(kind: "ponuda" | "zahtev", id: string, userId: string, photos: ListingPhoto[]) {
  if (photos.length > MAX_PHOTOS) throw new Error("Dozvoljeno je najviše 7 fotografija.");
  const column = kind === "ponuda" ? "ponuda_id" : "zahtev_id";
  const { data: existing, error: readError } = await supabase.from("slike_oglasa").select("*").eq(column, id);
  if (readError) throw readError;
  const keepIds = new Set(photos.map((p) => p.id).filter(Boolean));
  const removeRows = (existing ?? []).filter((row) => !keepIds.has(row.id));
  for (const row of removeRows) {
    if (row.storage_path) await supabase.storage.from("slike-oglasa").remove([row.storage_path]);
    const { error } = await supabase.from("slike_oglasa").delete().eq("id", row.id);
    if (error) throw error;
  }
  for (let index = 0; index < photos.length; index++) {
    const photo = photos[index];
    if (photo.id) {
      const { error } = await supabase.from("slike_oglasa").update({ pozicija: index }).eq("id", photo.id);
      if (error) throw error;
      continue;
    }
    if (photo.externalUrl) {
      const payload = { [column]: id, external_url: photo.externalUrl, storage_path: null, pozicija: index };
      const { error } = await supabase.from("slike_oglasa").insert(payload);
      if (error) throw error;
      continue;
    }
    if (photo.file) {
      const path = `${userId}/${kind}/${id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("slike-oglasa").upload(path, photo.file, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      const payload = { [column]: id, storage_path: path, external_url: null, pozicija: index };
      const { error } = await supabase.from("slike_oglasa").insert(payload);
      if (error) {
        await supabase.storage.from("slike-oglasa").remove([path]);
        throw error;
      }
    }
  }
}
