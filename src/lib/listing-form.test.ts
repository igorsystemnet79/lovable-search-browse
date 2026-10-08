/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { listingFormSchema } from "./listing-form";

const listing = { naslov: "Polovan bicikl", opis: "Očuvan", kategorija: "Sport", lokacija: "Beograd", kontakt_ime: "Prodavac", telefon: "+381 60 123 4567", iznos: "", valuta: "EUR" };
describe("listing data", () => {
  test("requires what is offered or requested", () => {
    expect(listingFormSchema.safeParse({ ...listing, naslov: "" }).success).toBe(false);
  });
  test("requires the location", () => {
    expect(listingFormSchema.safeParse({ ...listing, lokacija: "" }).success).toBe(false);
  });
  test("requires the contact person", () => {
    expect(listingFormSchema.safeParse({ ...listing, kontakt_ime: "" }).success).toBe(false);
  });
  test("requires a phone number", () => {
    expect(listingFormSchema.safeParse({ ...listing, telefon: "" }).success).toBe(false);
    expect(listingFormSchema.safeParse(listing).success).toBe(true);
  });
});