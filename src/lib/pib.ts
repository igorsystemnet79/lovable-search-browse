/** Validates a Serbian PIB (9 digits, ISO 7064 MOD 11,10 check digit). */
export function ispravanPib(raw: string): boolean {
  const pib = raw.replace(/\s/g, "");
  if (!/^[0-9]{9}$/.test(pib)) return false;
  let s = 10;
  for (let i = 0; i < 8; i++) {
    s = (s + Number(pib[i])) % 10;
    if (s === 0) s = 10;
    s = (s * 2) % 11;
  }
  return (11 - s) % 10 === Number(pib[8]);
}
