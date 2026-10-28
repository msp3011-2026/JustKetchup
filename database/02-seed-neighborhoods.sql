-- JustKetchup — NYC neighborhoods
-- Run AFTER 01-justketchup-schema.sql. Safe to re-run.
--
-- This is the only location data we keep. Venues are fetched live from
-- Google Places at request time, filtered on rating, review count, price,
-- cuisine and dietary needs.

insert into public.neighborhoods (city, name, lat, lng) values
  ('New York', 'Upper West Side',    40.7870, -73.9754),
  ('New York', 'Upper East Side',    40.7736, -73.9566),
  ('New York', 'Harlem',             40.8116, -73.9465),
  ('New York', 'Midtown',            40.7549, -73.9840),
  ('New York', 'Hell''s Kitchen',    40.7638, -73.9918),
  ('New York', 'Chelsea',            40.7465, -74.0014),
  ('New York', 'Flatiron',           40.7401, -73.9903),
  ('New York', 'Gramercy',           40.7368, -73.9845),
  ('New York', 'West Village',       40.7358, -74.0036),
  ('New York', 'East Village',       40.7265, -73.9815),
  ('New York', 'Lower East Side',    40.7150, -73.9843),
  ('New York', 'SoHo',               40.7233, -74.0030),
  ('New York', 'Tribeca',            40.7163, -74.0086),
  ('New York', 'Financial District', 40.7075, -74.0113),
  ('New York', 'Williamsburg',       40.7081, -73.9571),
  ('New York', 'Greenpoint',         40.7304, -73.9540),
  ('New York', 'Bushwick',           40.6944, -73.9213),
  ('New York', 'Bedford-Stuyvesant', 40.6872, -73.9418),
  ('New York', 'Fort Greene',        40.6892, -73.9743),
  ('New York', 'Clinton Hill',       40.6896, -73.9661),
  ('New York', 'Brooklyn Heights',   40.6960, -73.9933),
  ('New York', 'Downtown Brooklyn',  40.6928, -73.9857),
  ('New York', 'DUMBO',              40.7033, -73.9881),
  ('New York', 'Boerum Hill',        40.6850, -73.9846),
  ('New York', 'Cobble Hill',        40.6866, -73.9962),
  ('New York', 'Gowanus',            40.6736, -73.9890),
  ('New York', 'Park Slope',         40.6710, -73.9814),
  ('New York', 'Carroll Gardens',    40.6795, -73.9999),
  ('New York', 'Crown Heights',      40.6694, -73.9442),
  ('New York', 'Prospect Heights',   40.6774, -73.9668),
  ('New York', 'Astoria',            40.7644, -73.9235),
  ('New York', 'Long Island City',   40.7447, -73.9485),
  ('New York', 'Sunnyside',          40.7433, -73.9196),
  ('New York', 'Jackson Heights',    40.7557, -73.8831),
  ('New York', 'Jersey City',        40.7178, -74.0431),
  ('New York', 'Hoboken',            40.7439, -74.0324)
on conflict (city, name) do nothing;
