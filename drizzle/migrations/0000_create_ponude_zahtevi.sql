CREATE TABLE public.ponude (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naslov text NOT NULL,
  opis text,
  kategorija text NOT NULL,
  lokacija text NOT NULL,
  cena numeric,
  valuta text NOT NULL DEFAULT 'EUR',
  emoji text,
  istaknuto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ponude TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponude TO authenticated;
GRANT ALL ON public.ponude TO service_role;

ALTER TABLE public.ponude ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ponude su javno vidljive" ON public.ponude FOR SELECT USING (true);

CREATE TABLE public.zahtevi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naslov text NOT NULL,
  opis text,
  kategorija text NOT NULL,
  lokacija text NOT NULL,
  budzet numeric,
  valuta text NOT NULL DEFAULT 'EUR',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.zahtevi TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zahtevi TO authenticated;
GRANT ALL ON public.zahtevi TO service_role;

ALTER TABLE public.zahtevi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Zahtevi su javno vidljivi" ON public.zahtevi FOR SELECT USING (true);

INSERT INTO public.ponude (naslov, opis, kategorija, lokacija, cena, emoji, istaknuto, created_at) VALUES
('iPhone 14', 'Odlicno ocuvan iPhone 14, 128 GB, sa punjacem.', 'Mobilni telefoni', 'Beograd', 850, '📱', true, now() - interval '1 hour'),
('Golf 8', 'Volkswagen Golf 8, 2021. godiste, prvi vlasnik.', 'Automobili', 'Novi Sad', 22000, '🚗', true, now() - interval '2 hours'),
('MacBook Pro', 'MacBook Pro M2, 16 GB RAM, 512 GB SSD.', 'Računari', 'Beograd', 1450, '💻', true, now() - interval '3 hours'),
('Stan 55 m²', 'Dvosoban stan, centar grada, renoviran.', 'Nekretnine', 'Niš', 120000, '🏠', true, now() - interval '5 hours'),
('PlayStation 5', 'PS5 sa dva dzojstika i tri igrice.', 'Sport', 'Kragujevac', 450, '🎮', true, now() - interval '6 hours'),
('Samsung Galaxy S23', 'Nov telefon u garanciji, 256 GB.', 'Mobilni telefoni', 'Beograd', 620, '📱', false, now() - interval '8 hours'),
('Audi A4 2.0 TDI', 'Servisna knjiga, 180.000 km.', 'Automobili', 'Subotica', 13500, '🚗', false, now() - interval '9 hours'),
('Kuhinja po meri', 'Izrada kuhinje po meri, montaza ukljucena.', 'Sve za kuću', 'Novi Sad', 1200, '🍽️', false, now() - interval '11 hours'),
('Zimske gume 205/55 R16', 'Set od 4 gume, korisceno jednu sezonu.', 'Automobili', 'Cacak', 160, '🛞', false, now() - interval '13 hours'),
('Muska zimska jakna', 'Velicina L, kao nova.', 'Moda', 'Beograd', 45, '🧥', false, now() - interval '15 hours'),
('Bicikl MTB 29"', 'Aluminijumski ram, hidraulicne kocnice.', 'Sport', 'Novi Sad', 380, '🚲', false, now() - interval '18 hours'),
('Gaming racunar RTX 4060', 'Ryzen 5, 32 GB RAM, 1 TB NVMe.', 'Računari', 'Niš', 950, '💻', false, now() - interval '20 hours'),
('Poslovni prostor 40 m²', 'Prizemlje, izlog, odlicna lokacija.', 'Nekretnine', 'Beograd', 65000, '🏢', false, now() - interval '1 day'),
('Kolekcija starih novcica', 'Jugoslovenski novcici, preko 200 komada.', 'Kolekcionarstvo', 'Zrenjanin', 300, '🪙', false, now() - interval '1 day 4 hours'),
('Posao: konobar', 'Trazimo konobara za rad u kafeu, puno radno vreme.', 'Posao', 'Beograd', NULL, '🧑‍🍳', false, now() - interval '1 day 8 hours'),
('Ves masina Bosch', 'Ispravna, 7 kg, garancija 3 meseca.', 'Sve za kuću', 'Kragujevac', 180, '🧺', false, now() - interval '2 days'),
('iPad Air 5', '64 GB, WiFi, sa futrolom.', 'Računari', 'Novi Sad', 520, '📱', false, now() - interval '2 days 5 hours'),
('Zenske cizme br. 38', 'Prava koza, nosene par puta.', 'Moda', 'Niš', 55, '👢', false, now() - interval '3 days');

INSERT INTO public.zahtevi (naslov, opis, kategorija, lokacija, budzet, created_at) VALUES
('Tražim iPhone 15 Pro, 256 GB', 'Kupujem ocuvan telefon, moze i zamena.', 'Mobilni telefoni', 'Beograd', 1000, now() - interval '2 hours'),
('Potrebna pomoć pri selidbi', 'Dvosoban stan, subota ujutru.', 'Posao', 'Novi Sad', 80, now() - interval '3 hours'),
('Kupujem polovan automobil do 5.000 €', 'Benzin ili dizel, registrovan.', 'Automobili', 'Niš', 5000, now() - interval '5 hours'),
('Tražim majstora za renoviranje kupatila', 'Kompletno renoviranje, 5 m².', 'Sve za kuću', 'Kragujevac', 2000, now() - interval '6 hours'),
('Potrebna pomoć oko instalacije Windowsa', 'Laptop, dolazak na adresu.', 'Računari', 'Beograd', 30, now() - interval '8 hours'),
('Tražim stan za izdavanje', 'Jednosoban, namesten, centar.', 'Nekretnine', 'Novi Sad', 400, now() - interval '10 hours'),
('Kupujem PlayStation 5', 'Sa garancijom ako je moguce.', 'Sport', 'Beograd', 400, now() - interval '14 hours'),
('Tražim instruktora vožnje', 'Dodatni casovi pred polaganje.', 'Posao', 'Niš', 100, now() - interval '18 hours'),
('Kupujem polovan laptop za studenta', 'Do 8 GB RAM, i5 ili bolji.', 'Računari', 'Subotica', 350, now() - interval '1 day'),
('Tražim zimske gume 195/65 R15', 'Moze i polovno, dobra sara.', 'Automobili', 'Cacak', 120, now() - interval '1 day 6 hours'),
('Tražim vencanicu br. 38', 'Iznajmljivanje ili kupovina.', 'Moda', 'Beograd', 300, now() - interval '2 days'),
('Kupujem stare gramofonske ploce', 'Rok i dzez izdanja.', 'Kolekcionarstvo', 'Novi Sad', 200, now() - interval '3 days');