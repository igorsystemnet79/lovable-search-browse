/// <reference types="bun" />
import { expect, test } from "bun:test";
import { ispravanPib } from "../src/lib/pib";

test("prihvata PIB sa ispravnom kontrolnom cifrom", () => {
  expect(ispravanPib("100002887")).toBe(true);
});
test("odbija PIB sa pogrešnom kontrolnom cifrom", () => {
  expect(ispravanPib("100002888")).toBe(false);
});
test("odbija PIB koji nema 9 cifara", () => {
  expect(ispravanPib("12345678")).toBe(false);
});
