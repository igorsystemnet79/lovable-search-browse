export type Kategorija = { slug: string; naziv: string; slika: string };

export const kategorije: Kategorija[] = [
  { slug: "automobili", naziv: "Automobili", slika: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=500&h=400&fit=crop" },
  { slug: "nekretnine", naziv: "Nekretnine", slika: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=500&h=400&fit=crop" },
  { slug: "mobilni-telefoni", naziv: "Mobilni telefoni", slika: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&h=400&fit=crop" },
  { slug: "racunari", naziv: "Računari", slika: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&h=400&fit=crop" },
  { slug: "moda", naziv: "Moda", slika: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&h=400&fit=crop" },
  { slug: "sport", naziv: "Sport", slika: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500&h=400&fit=crop" },
  { slug: "posao", naziv: "Posao", slika: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=500&h=400&fit=crop" },
  { slug: "sve-za-kucu", naziv: "Sve za kuću", slika: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=500&h=400&fit=crop" },
  { slug: "kolekcionarstvo", naziv: "Kolekcionarstvo", slika: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=500&h=400&fit=crop" },
];

export const nadjiKategoriju = (slug: string) => kategorije.find((k) => k.slug === slug);
