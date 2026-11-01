export type Kategorija = {
  slug: string;
  naziv: string;
  slika: string;
  fotoAutor: string;
  fotoIzvor: string;
  podkategorije: string[];
};

// Fotografije su sa Pexels-a. Izvori i autori su evidentirani u
// docs/pexels-category-image-credits.md. Sve fotografije su označene
// kao besplatne za korišćenje pod Pexels licencom.
export const kategorije: Kategorija[] = [
  {
    slug: "automobili",
    naziv: "Automobili",
    slika: "https://images.pexels.com/photos/27745644/pexels-photo-27745644.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Ralf Feltes",
    fotoIzvor: "https://www.pexels.com/photo/a-vintage-car-parked-on-the-side-of-the-road-27745644/",
    podkategorije: ["Polovni automobili", "Novi automobili", "Delovi i oprema", "Gume i felne", "Auto kozmetika", "Auto-servisi", "Motocikli", "Kamioni i kombi vozila", "Plovila"],
  },
  {
    slug: "nekretnine",
    naziv: "Nekretnine",
    slika: "https://images.pexels.com/photos/5824901/pexels-photo-5824901.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Charlotte May",
    fotoIzvor: "https://www.pexels.com/photo/living-room-interior-with-furniture-and-plants-at-home-5824901/",
    podkategorije: ["Stanovi – prodaja", "Stanovi – izdavanje", "Kuće – prodaja", "Kuće – izdavanje", "Zemljišta", "Poslovni prostori", "Vikendice", "Garaže i parking mesta", "Apartmani i sobe"],
  },
  {
    slug: "mobilni-telefoni",
    naziv: "Mobilni telefoni",
    slika: "https://images.pexels.com/photos/22604121/pexels-photo-22604121.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Andrey Matveev",
    fotoIzvor: "https://www.pexels.com/photo/close-up-of-a-person-holding-a-smartphone-displaying-notifications-22604121/",
    podkategorije: ["Apple iPhone", "Samsung", "Xiaomi", "Ostali mobilni telefoni", "Pametni satovi", "Maske i zaštita", "Punjači i kablovi", "Delovi i servis"],
  },
  {
    slug: "racunari",
    naziv: "Računari",
    slika: "https://images.pexels.com/photos/6483627/pexels-photo-6483627.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Mikael Blomkvist",
    fotoIzvor: "https://www.pexels.com/photo/laptop-on-desk-6483627/",
    podkategorije: ["Laptopovi", "Desktop računari", "Gaming računari", "Komponente", "Monitori", "Tastature i miševi", "Štampači i skeneri", "Mrežna oprema", "Softver"],
  },
  {
    slug: "moda",
    naziv: "Moda",
    slika: "https://images.pexels.com/photos/8989864/pexels-photo-8989864.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Alena Darmel",
    fotoIzvor: "https://www.pexels.com/photo/close-up-of-a-clothing-rack-8989864/",
    podkategorije: ["Ženska odeća", "Muška odeća", "Dečija odeća", "Obuća", "Torbe i rančevi", "Satovi i nakit", "Modni dodaci", "Sportska odeća"],
  },
  {
    slug: "sport",
    naziv: "Sport",
    slika: "https://images.pexels.com/photos/5878660/pexels-photo-5878660.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Antoni Shkraba",
    fotoIzvor: "https://www.pexels.com/photo/a-man-using-a-stationary-bicycle-5878660/",
    podkategorije: ["Fitnes i teretana", "Bicikli i oprema", "Kampovanje i planinarenje", "Ribolov", "Lopte i timski sportovi", "Skijanje i zimski sportovi", "Vodeni sportovi", "Oprema za rekreaciju"],
  },
  {
    slug: "posao",
    naziv: "Posao",
    slika: "https://images.pexels.com/photos/6483627/pexels-photo-6483627.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Mikael Blomkvist",
    fotoIzvor: "https://www.pexels.com/photo/laptop-on-desk-6483627/",
    podkategorije: ["Puno radno vreme", "Pola radnog vremena", "Privremeni i sezonski poslovi", "Rad od kuće", "Praksa i obuka", "Honorarni poslovi", "Ostali poslovi"],
  },
  {
    slug: "sve-za-kucu",
    naziv: "Sve za kuću",
    slika: "https://images.pexels.com/photos/5825398/pexels-photo-5825398.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Charlotte May",
    fotoIzvor: "https://www.pexels.com/photo/living-room-interior-with-cozy-sofa-in-house-5825398/",
    podkategorije: ["Nameštaj", "Kuhinje i trpezarije", "Kućni aparati", "Bela tehnika", "Dekoracija i rasveta", "Bašta i dvorište", "Posuđe i oprema", "Grejanje i hlađenje", "Oprema za domaćinstvo"],
  },
  {
    slug: "kolekcionarstvo",
    naziv: "Kolekcionarstvo",
    slika: "https://images.pexels.com/photos/14936593/pexels-photo-14936593.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Damla Karaağaçlı",
    fotoIzvor: "https://www.pexels.com/photo/a-collection-of-antiques-beside-coins-on-tray-14936593/",
    podkategorije: ["Novčići i papirni novac", "Antikviteti", "Poštanske marke", "Razglednice", "Satovi", "Umetnine", "Stari predmeti", "Kolekcionarske figure"],
  },
  {
    slug: "poljoprivreda",
    naziv: "Poljoprivreda",
    slika: "https://images.pexels.com/photos/37201225/pexels-photo-37201225.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Mark Stebnicki",
    fotoIzvor: "https://www.pexels.com/photo/aerial-view-of-plowed-field-with-tractor-and-workers-37201225/",
    podkategorije: ["Traktori", "Poljoprivredne mašine", "Priključne mašine", "Oprema i alati", "Stočarstvo", "Žitarice i semena", "Voće i povrće", "Ostalo za poljoprivredu"],
  },
  {
    slug: "gradjevina-alati",
    naziv: "Građevina i alati",
    slika: "https://images.pexels.com/photos/8470252/pexels-photo-8470252.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Anastasia Shuraeva",
    fotoIzvor: "https://www.pexels.com/photo/a-close-up-shot-of-a-toolbox-8470252/",
    podkategorije: ["Ručni alati", "Električni alati", "Građevinski materijal", "Mašine i oprema", "Vodovod i grejanje", "Stolarija", "Boje i lakovi", "Zaštitna oprema"],
  },
  {
    slug: "kucni-ljubimci",
    naziv: "Kućni ljubimci",
    slika: "https://images.pexels.com/photos/28852102/pexels-photo-28852102.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Alex Jaison",
    fotoIzvor: "https://www.pexels.com/photo/dog-and-cat-standing-together-in-nature-28852102/",
    podkategorije: ["Psi", "Mačke", "Ptice", "Ribice i akvarijumi", "Ostale životinje", "Hrana i oprema", "Nega i veterinarske usluge"],
  },
  {
    slug: "muzika-instrumenti",
    naziv: "Muzika i instrumenti",
    slika: "https://images.pexels.com/photos/18762059/pexels-photo-18762059.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Weavehall Collective",
    fotoIzvor: "https://www.pexels.com/photo/electric-piano-and-guitars-in-a-room-18762059/",
    podkategorije: ["Gitare i bas gitare", "Klavijature i klaviri", "Bubnjevi i perkusije", "Duvački instrumenti", "Ozvučenje", "Studijska oprema", "Audio oprema", "Muzički pribor"],
  },
  {
    slug: "usluge",
    naziv: "Usluge",
    slika: "https://images.pexels.com/photos/6483627/pexels-photo-6483627.jpeg?auto=compress&cs=tinysrgb&w=900",
    fotoAutor: "Mikael Blomkvist",
    fotoIzvor: "https://www.pexels.com/photo/laptop-on-desk-6483627/",
    podkategorije: ["Majstorske usluge", "Prevoz i selidbe", "Čišćenje i održavanje", "Servisi i popravke", "Lepota i nega", "Edukacija i časovi", "IT i digitalne usluge", "Poslovne usluge", "Ostale usluge"],
  },
];

export const nadjiKategoriju = (slug: string) => kategorije.find((k) => k.slug === slug);

export const vrednostKategorije = (kategorija: string) =>
  kategorije.some((k) => kategorija === k.naziv || k.podkategorije.some((pod) => kategorija === `${k.naziv} / ${pod}`));
