# Generalforsamling – GitHub Pages + Supabase prototype

Denne versjonen er koblet til Supabase, men kan også kjøres som lokal demo dersom Supabase ikke er konfigurert.

## Innhold

- `index.html` – deltakerside
- `admin.html` – adminside
- `style.css` – utseende
- `js/supabase.js` – Supabase-tilkobling og databasefunksjoner
- `js/admin.js` – adminlogikk
- `js/app.js` – deltakerlogikk
- `js/stv.js` – STV/RCV-opptelling
- `supabase.sql` – database og prototype-RLS-policyer

## 1. Opprett Supabase

1. Opprett et gratis Supabase-prosjekt.
2. Åpne **SQL Editor**.
3. Lim inn hele innholdet i `supabase.sql`.
4. Kjør SQL-en.

## 2. Koble nettsiden til Supabase

Åpne `js/supabase.js` og fyll inn:

```js
const SUPABASE_URL = "DIN_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY = "DIN_SUPABASE_PUBLISHABLE_KEY";
```

Bruk **publishable/anon key**, aldri service-role/secret key i nettleseren.

## 3. GitHub Pages

1. Opprett et GitHub repository.
2. Last opp alle filene med samme mappestruktur.
3. Gå til Settings → Pages.
4. Velg `Deploy from a branch`.
5. Velg `main` og `/ (root)`.
6. Deltakerside: `https://DITT-BRUKERNAVN.github.io/REPO/`
7. Admin: `https://DITT-BRUKERNAVN.github.io/REPO/admin.html`

## Logo

Admin-siden har nå en bilderamme og knapp for å laste opp PNG/JPG/SVG. I denne versjonen lagres logoen lokalt i nettleseren som en visuell plassholder. Dersom logoen skal vises på alle deltaker-enheter, bør den neste versjonen bruke Supabase Storage.

## Viktig om sikkerhet

`supabase.sql` inneholder åpne prototype-policyer slik at frontend kan testes direkte. Dette er **ikke egnet for en faktisk avstemning** uten videre sikring.

Før reell bruk bør vi blant annet legge til:

- admin-innlogging med Supabase Auth
- engangs-/stemmekoder som ikke kan gjenbrukes
- RLS som hindrer deltakere i å lese alle stemmer
- validering av at stemmegivningen er aktiv
- streng validering av rangeringer
- sikker lagring av logo i Supabase Storage
- transaksjonell og grundig testet STV-opptelling
- implementasjon og testing av representasjonskravet for styrevalget

## Gjeldende begrensning

STV-modulen er fortsatt en prototype. Den bør valideres mot den nøyaktige valgordningen før systemet brukes i en virkelig generalforsamling.
