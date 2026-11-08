import { z } from "zod";

export const listingFormSchema = z.object({
  naslov: z.string().trim().min(3, "Unesi najmanje 3 karaktera u naslov.").max(150),
  opis: z.string().trim().max(3000),
  kategorija: z.string().trim().min(1, "Izaberi kategoriju."),
  lokacija: z.string().trim().min(2, "Unesi mesto.").max(100),
  kontakt_ime: z.string().trim().min(5, "Unesi ime i prezime.").max(100).refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, "Unesi i ime i prezime."),
  telefon: z.string().trim().regex(/^[+0-9 ()-]{6,30}$/, "Unesi ispravan broj telefona."),
  iznos: z.string().trim().refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "Iznos ne može biti negativan."),
  valuta: z.enum(["EUR", "RSD"]),
});
export type ListingFormValues = z.infer<typeof listingFormSchema>;