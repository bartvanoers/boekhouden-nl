# Boekhouden

Een simpele self-hosted webapplicatie voor de eigen boekhouding. Eén administratie met meerdere boekjaren. Draait als één Docker-container met een SQLite-database op
een volume.

**Buiten scope:** facturen maken, Excel-import, meerdere gebruikers of administraties, bankkoppelingen.

## Functionaliteit

- **Verkopen & inkopen** — één register per richting met datum, soort
  (factuur/bonnetje/overig), factuurnummer, omschrijving, relatie, bedrag excl.
  btw, btw-tarief (21% / 9% / geen), status (bank / kas / openstaand) en
  grootboekcategorie. Live btw-berekening bij invoer, overschrijfbaar voor
  afwijkende bonnetjes.
- **Relaties** — klanten en leveranciers, gedeeld over alle boekjaren.
- **Grootboek** — standaardschema (0130 t/m 8010); systeemrekeningen zijn
  vergrendeld, overige rekeningen kunnen worden gedeactiveerd.
- **Beginbalans** — per balansrekening, met live activa = passiva-controle.
- **BTW-overzicht** — per maand, kwartaal of jaar (rubrieken 1a / 1b / 0% en
  voorbelasting 5b), met export.
- **Dashboard** — totalen per richting, winst & verlies, balans en btw-stand.
- **Jaarafsluiting** — de eindbalans wordt overgedragen naar een nieuw boekjaar
  (resultaat naar Beginkapitaal); het afgesloten jaar wordt alleen-lezen en kan
  weer worden heropend.
- **Export** — CSV (`;`-gescheiden, met BOM voor NL-Excel) en XLSX van
  transacties, btw, winst & verlies en balans.

## Technische kern

- **Next.js 15** (App Router, React Server Components) + **TypeScript**.
- **SQLite** via **better-sqlite3** + **Drizzle ORM**; WAL-mode, migrate + seed
  bij het opstarten (`src/instrumentation.ts`).
- **Tailwind CSS + shadcn/ui**; alle teksten in het Nederlands.
- **iron-session** (versleutelde cookie) + **argon2id** voor authenticatie.
- Euro-waarden worden altijd als gehele **centen** opgeslagen; datums als TEXT
  `YYYY-MM-DD`.

---

# Hoe het werkt (gebruikersflow)

Deze sectie loopt de levenscyclus door zoals je die als gebruiker beleeft.

## Eerste start — setup

Bij een verse database migreert en seedt de app zichzelf (standaardgrootboek +
een boekjaar voor het huidige jaar; zie [Opstartgedrag](#opstartgedrag)). Er is
nog geen wachtwoord ingesteld, dus elke route leidt naar **`/setup`**. Daar geef
je een **bedrijfsnaam** op (vrij instelbaar, later te wijzigen op
`/instellingen`) en een **wachtwoord** (minstens 10 tekens, met bevestiging). De
app slaat de argon2id-hash op in de `settings`-tabel, logt je meteen in en
brengt je naar het dashboard. Zodra er een hash bestaat, is `/setup` niet meer
bereikbaar.

## Beginbalans invoeren

Ga naar **`/beginbalans`** en zet per balansrekening het beginsaldo van het jaar
neer: activa (bezittingen zoals Bank, Inventaris) links, passiva (schulden,
Beginkapitaal) rechts. Het scherm toont een **live sluitcontrole**: pas als
activa gelijk is aan passiva sluit de beginbalans. Intern wordt elk bedrag
_getekend_ opgeslagen (activa positief, passiva negatief), zodat "de balans
sluit" simpelweg betekent dat de som nul is.

De beginbalans hoef je maar één keer met de hand in te voeren, voor het
allereerste boekjaar. Bij een jaarafsluiting wordt de beginbalans van het
volgende jaar automatisch afgeleid uit de eindbalans (zie
[Jaarafsluiting](#jaarafsluiting)).

## Dagelijks boeken — verkopen en inkopen

**`/verkopen`** en **`/inkopen`** delen hetzelfde registercomponent; alleen de
richting verschilt. Je opent het dialoogformulier en vult per transactie in:

- **Datum** — moet binnen het actieve boekjaar vallen (server-side afgedwongen).
- **Soort** — `Factuur`, `Bonnetje` of `Overig`. Puur administratief; heeft geen
  invloed op de berekeningen.
- **Factuurnummer / Omschrijving / Relatie** — omschrijving is verplicht, de
  rest optioneel. De relatie kies je uit de eerder aangemaakte relaties.
- **Bedrag excl. btw** — je typt een gewoon NL-bedrag ("1.234,56"); dit wordt
  naar gehele centen geparsed.
- **Btw-tarief** — `21%` (hoog), `9%` (laag) of `Geen btw`.
- **Btw-bedrag** — wordt **live berekend** uit bedrag × tarief (`Math.round` op
  hele centen) zodra je het bedrag of tarief aanpast, maar is **handmatig
  overschrijfbaar**. Wijk je af (bijvoorbeeld bij een bonnetje waarop een net
  iets ander btw-bedrag staat), dan bewaart de app jouw bedrag; het formulier
  herkent later dat de opgeslagen btw afwijkt van de automatische berekening en
  laat de handmatige waarde staan.
- **Status** — `Betaald via Bank`, `Betaald via Kas` of `Openstaand`. Dit
  bepaalt op welke balansrekening de tegenboeking landt (Bank, Kas, of
  Debiteuren/Crediteuren).
- **Categorie** — de grootboekrekening. Standaard `8000 Omzet NL` voor verkoop en
  `7000 Inkopen` voor inkoop; je kunt elke actieve rekening kiezen. Boek je op
  een balansrekening (bijv. `0130 Inventarissen`), dan is het geen kostenpost
  maar een balansmutatie — hij telt niet mee in de winst.

De tabel is te filteren op periode (kwartaal/maand), status en relatie, en toont
per rij bedrag excl. en incl. btw. Bewerken en verwijderen kan zolang het
boekjaar open is; in een gesloten boekjaar zijn alle mutaties geblokkeerd (knoppen
uit én server-side geweigerd).

## BTW-aangifte doen aan de hand van `/btw`

Het scherm **`/btw`** groepeert alle transacties van het actieve boekjaar per
periode volgens de **btw-aangifteperiode van dat boekjaar** (maand, kwartaal of
jaar — instelbaar per boekjaar). Per periode zie je de rubrieken zoals je ze op
het aangifteformulier van de Belastingdienst overneemt:

| Rubriek | Betekenis | Wat vul je in |
|---|---|---|
| **1a** | Leveringen/diensten belast met **21%** | grondslag (omzet excl.) + btw |
| **1b** | Leveringen/diensten belast met **9%** | grondslag (omzet excl.) + btw |
| **0%** | Verkoop **zonder btw** | alleen de grondslag |
| **5b** | **Voorbelasting** = som van de btw op je inkopen | het btw-bedrag |
| **Te betalen** | `btw verkoop − voorbelasting` | positief = betalen, negatief = terugvragen |

De rubrieken 1a/1b komen uit je verkopen met tarief hoog/laag; 5b is de optelsom
van alle btw op je inkopen, ongeacht tarief. Het bedrag "te betalen" is precies
wat je bij de aangifte afdraagt (of, bij een negatief bedrag, terugvraagt). Naast
de periodetabel staat het **jaartotaal**, en er is een exportknop voor CSV/XLSX.

## Relaties en grootboek beheren

- **`/relaties`** — CRUD van klanten/leveranciers. Elke relatie krijgt een
  oplopend nummer. Relaties zijn **gedeeld over alle boekjaren**. Een relatie die
  in transacties is gebruikt kun je op inactief zetten in plaats van verwijderen.
- **`/grootboek`** — CRUD van het rekeningschema, ook **gedeeld over boekjaren**.
  De acht **systeemrekeningen** (`1000` Kas, `1010` Bank, `1300` Debiteuren,
  `1600` Voorbelasting, `1630`/`1631` Af te dragen btw, `1650` BTW
  rekening-courant, `1700` Crediteuren) zijn vergrendeld: de boekingslogica leunt
  erop, dus ze zijn niet te verwijderen. Andere rekeningen kun je toevoegen of —
  als ze al gebruikt zijn — op inactief zetten.

## Jaarafsluiting

Op **`/instellingen`** beheer je de boekjaren en sluit je een jaar af. Bij het
afsluiten van boekjaar N gebeurt in één database-transactie het volgende:

1. De **eindbalans** (alle balanssaldi) van jaar N wordt berekend.
2. Boekjaar **N+1** wordt aangemaakt (of hergebruikt) met dezelfde
   btw-aangifteperiode.
3. De **beginbalans van N+1** wordt gevuld met die eindsaldi. Het **resultaat
   lopend boekjaar** (winst of verlies) vloeit daarbij in `1400 Beginkapitaal`,
   zodat de nieuwe beginbalans sluit (som getekend = 0).
4. Boekjaar N gaat op **`gesloten`**: alleen-lezen. Een gele banner bovenin geeft
   dit aan.

**Heropenen** kan altijd: dat zet het boekjaar terug op `open` en maakt het weer
bewerkbaar. Sluit je daarna opnieuw af, dan wordt de beginbalans van N+1 volledig
opnieuw opgebouwd (de oude overdracht wordt eerst verwijderd), dus correcties in
een heropend jaar komen correct door.

Welk boekjaar "actief" is, kies je met de **boekjaar-switcher** in de zijbalk;
die keuze wordt in een cookie bewaard. Alle schermen en rapporten tonen het
actieve boekjaar.

---

# Hoe de app in elkaar steekt (architectuur)

## Projectstructuur

```
src/
  app/
    (auth)/                 # login + eenmalige setup (eigen minimale layout)
      login/                #   wachtwoordformulier
      setup/                #   eerste wachtwoord + bedrijfsnaam
    (app)/                  # de ingelogde app-shell (zijbalk, switcher, uitloggen)
      page.tsx              #   dashboard / financieel overzicht
      verkopen/ inkopen/    #   transactieregisters (delen één component)
      relaties/ grootboek/  #   stamgegevens-CRUD
      beginbalans/          #   beginbalans met live sluitcheck
      btw/                  #   btw-overzicht per periode
      instellingen/         #   bedrijfsgegevens, wachtwoord, boekjaren/afsluiting
    api/
      health/               #   healthcheck voor Docker
      export/[report]/      #   CSV/XLSX-download
  actions/                  # server actions (mutaties): auth, transacties,
                            #   relaties, grootboek, beginbalans, boekjaren,
                            #   jaarafsluiting, instellingen
  components/               # UI: register, switcher, nav, shadcn/ui-primitieven
  db/
    schema.ts               # Drizzle-schema (de zes tabellen)
    index.ts                # connectie (WAL, foreign keys), gedeelde singleton
    migrate.ts              # migrate-on-boot runner
    seed.ts                 # idempotente seed (grootboek + boekjaar)
  lib/
    auth/                   # session, password (argon2id), rate-limit
    schemas/                # Zod-schemas (transactie, relatie, grootboek, ...)
    reports/                # afgeleide rapportages (zie hieronder)
    export/                 # CSV/XLSX-opbouw
    money.ts  dates.ts      # centen-helpers, YYYY-MM-DD-helpers
    boekjaar.ts             # actief-boekjaar-keuze (cookie + db)
    settings.ts             # bedrijfsnaam uit settings-tabel
  middleware.ts             # sessie-redirect (eerste verdedigingslaag)
  instrumentation.ts        # opstarthook → instrumentation-node.ts (migrate+seed)
drizzle/                    # gegenereerde SQL-migraties + metadata
Dockerfile  docker-compose.yml
```

## Datamodel

Zes tabellen (`src/db/schema.ts`). Enkele bewuste ontwerpkeuzes lopen door het
hele model:

- **Geld als integer centen.** Nergens floats in de opslag; `money.ts`
  formatteert (`formatEuro`) en parset (`parseEuro`) nl-NL-notatie.
- **Datums als TEXT `YYYY-MM-DD`.** Sorteert lexicografisch correct; met
  `substr`/regex haal je maand en kwartaal eruit zonder datumbibliotheek.
- **Booleans als integer 0/1** (`actief`, `is_systeem`).

| Tabel | Rol |
|---|---|
| `settings` | Singleton (id = 1): bedrijfsgegevens (bedrijfsnaam, adres, ob-/kvk-nummer, iban, …) en de `password_hash`. De bedrijfsnaam wordt overal uit deze tabel gelezen, nergens hardcoded. |
| `boekjaren` | Eén administratie, meerdere jaren. `jaar` (uniek), `btw_periode` (`maand`/`kwartaal`/`jaar`), `status` (`open`/`gesloten`). |
| `grootboekrekeningen` | Rekeningschema, **gedeeld over boekjaren**. `code` (TEXT, uniek — leidende nullen blijven behouden), `naam`, `type`, `is_systeem`, `actief`. |
| `relaties` | Klanten/leveranciers, **gedeeld over boekjaren**. Oplopend `nr`, adresvelden, `actief`. |
| `transacties` | **Verkoop én inkoop in één tabel** met een `richting`-veld (`verkoop`/`inkoop`). Zie hieronder. |
| `beginbalans` | Beginsaldo per boekjaar × grootboekrekening (uniek samen). `bedrag_cents` is **getekend**. |

**Eén transactietabel met richtingveld.** In plaats van aparte verkoop- en
inkooptabellen is er één `transacties`-tabel; `richting` bepaalt de betekenis.
Verdere velden: `boekjaar_id`, `datum`, `soort`, `factuurnummer`, `omschrijving`,
`relatie_id` (nullable), `bedrag_excl_cents`, `btw_tarief` (`hoog`/`laag`/`geen`),
`btw_cents` (opgeslagen zoals ingevoerd, dus overschrijfbaar), `status`
(`bank`/`kas`/`openstaand`), `grootboek_id`. Indexen op
`(boekjaar_id, richting, datum)`, `grootboek_id` en `relatie_id`.

**Grootboektypes.** Elke rekening heeft een `type` dat de boekingslogica stuurt:
`balans`, `betalingsmiddel`, `debiteuren`, `crediteuren`, `voorbelasting`,
`btw_hoog`, `btw_laag`, `btw_rc`, `winst_verlies`. De rapportages gebruiken deze
types plus een handvol vaste **systeemcodes** (`src/lib/reports/db.ts`):
Kas `1000`, Bank `1010`, Debiteuren `1300`, Beginkapitaal `1400`, Voorbelasting
`1600`, Af te dragen btw hoog/laag `1630`/`1631`, BTW R/C `1650`, Crediteuren
`1700`.

**Getekende beginbalans.** In `beginbalans` is `bedrag_cents` positief voor
debet/activa en negatief voor credit/passiva. Daardoor is de sluitcheck simpelweg
`SUM(bedrag_cents) = 0` — geen aparte activa/passiva-optelling nodig, en de
jaarafsluiting kan de eindsaldi één-op-één (getekend) overzetten.

**Actief boekjaar in een cookie.** Er is geen "huidig boekjaar" in de database;
de keuze staat in de cookie `boekjaar` en wordt door `getActiefBoekjaar()`
(`src/lib/boekjaar.ts`) gecombineerd met de boekjaarlijst: cookie-keuze indien
geldig, anders het meest recente open jaar, anders het meest recente jaar.

## Request-flow

- **Lezen via RSC.** De pagina's zijn React Server Components die rechtstreeks —
  synchroon, via better-sqlite3 — uit de database lezen. Er is geen API-laag voor
  reads; de RSC roept de rapportfunctie of query direct aan en rendert het
  resultaat. De app-routes draaien `dynamic = "force-dynamic"` omdat ze de cookie
  en database lezen.
- **Muteren via server actions.** Elke mutatie volgt hetzelfde vaste patroon:
  **`requireSession()` → Zod-validatie → controles → Drizzle → `revalidatePath`**.
  Zie bijvoorbeeld `src/actions/transacties.ts`. De Zod-schema's uit
  `src/lib/schemas/` worden gedeeld tussen de actions en de formulieren.
- **Route handlers alleen voor health en export.** `/api/health` doet een simpele
  `SELECT 1` voor de Docker-healthcheck; `/api/export/[report]` levert een
  bestandsdownload (`transacties`, `btw`, `wv`, `balans` in CSV of XLSX) en
  vereist eveneens een sessie. Verder zijn er geen API-endpoints.

## Rapportages

Alle overzichten worden **live uit de transacties berekend** — pure functies
`(db, boekjaarId) → ReportData` in `src/lib/reports/`, met `GROUP BY` in SQL en
dunne assemblage in TypeScript. Er is **geen dubbele boekhouding met opgeslagen
journaalposten en geen denormalisatie**: één transactierij is de enige bron van
waarheid, de "boekingen" ontstaan puur in de berekening. Dat maakt de functies
direct testbaar tegen een in-memory SQLite (zie [Testen](#testen)).

- **BTW** (`btw.ts`) — groepeert per periode (volgens `btw_periode` van het
  boekjaar) × richting × tarief. Verkoop hoog → rubriek 1a (grondslag + btw),
  verkoop laag → 1b, verkoop geen → 0% (alleen grondslag). Voorbelasting 5b =
  Σ btw op inkopen. Te betalen = Σ btw verkoop − Σ btw inkoop.
- **Winst & verlies** (`wv.ts`) — Σ `bedrag_excl_cents` per `winst_verlies`-
  rekening; verkoop levert opbrengsten, inkoop kosten. Resultaat = opbrengsten −
  kosten. Balansposten (zoals een via inkoop geboekte inventaris) tellen niet
  mee.
- **Balans** (`balans.ts` bovenop `saldi.ts`) — de saldofunctie bouwt per
  balansrekening een getekend saldo op (**debet positief, credit negatief**) uit:
  1. de (getekende) beginbalans;
  2. het betaal-/vorderingsbeen incl. btw: verkoop → + op Bank/Kas/Debiteuren,
     inkoop → − op Bank/Kas/Crediteuren (afhankelijk van de status);
  3. het btw-been: inkoop → + op Voorbelasting, verkoop → − op Af te dragen btw
     hoog/laag;
  4. het categoriebeen (excl. btw) voor de gekozen rekening, maar alleen als dat
     een balansrekening is (winst_verlies-rekeningen vloeien naar het resultaat).

  De som van alle balanssaldi is per constructie het **resultaat lopend
  boekjaar**; dat is de sluitpost aan de creditzijde, waardoor activa = passiva.
  `berekenBalans` splitst de saldi in activa (positief) en passiva (negatief,
  absoluut weergegeven) en zet de sluitpost erbij.
- **Dashboard** (`dashboard.ts`) — totalen per richting × status (totaal incl.,
  btw, betaald, openstaand) plus een compacte W&V, balans en btw-stand. Het
  assembleert dezelfde onderliggende functies, zodat dashboard en losse pagina's
  gegarandeerd dezelfde bedragen tonen.
- **Overdracht** (`overdracht.ts`) — leidt de beginbalans van het volgende jaar
  af uit de eindsaldi; het resultaat gaat naar `1400 Beginkapitaal`. Wordt door
  de jaarafsluiting-action gebruikt.

## Auth & security

- **Sessie in een versleutelde cookie** via iron-session; er is geen
  sessietabel. De cookie is `HttpOnly`, `SameSite=Lax` en `Secure` buiten
  development. `SESSION_SECRET` (≥ 32 tekens) is verplicht in productie; de
  sleutel wordt *lazy* opgelost zodat `next build` niet struikelt over een
  ontbrekende sleutel.
- **Wachtwoord met argon2id** (`@node-rs/argon2`), constant-time geverifieerd.
  De effectieve hash is `AUTH_PASSWORD_HASH` indien gezet, anders
  `settings.password_hash`.
- **Rate limiting** op login: max. 5 mislukte pogingen per 15 minuten per IP
  (`X-Forwarded-For`, eerste hop), in het procesgeheugen. De 6e poging wordt
  geblokkeerd; een succesvolle login wist de teller.
- **Defense in depth.** De **middleware** redirect ongeauthenticeerde requests
  naar `/login` (behalve `/login`, `/setup`, `/api/health` en assets). Daarnaast
  roept **elke** mutatie-action en beschermde route handler zelf
  `requireSession()` aan — mocht een request de middleware ooit omzeilen, dan
  blokkeert de tweede laag alsnog.
- **`AUTH_PASSWORD_HASH`-override.** Zetten van deze env var wint bij het
  inloggen van de opgeslagen hash (reset-mechanisme). Zolang hij gezet is, weigert
  de app het wachtwoord via **Instellingen** te wijzigen.

## Opstartgedrag

De **Next.js instrumentation-hook** (`src/instrumentation.ts`) draait één keer
bij het opstarten van de server. In de Node.js-runtime importeert die
`instrumentation-node.ts`, dat achtereenvolgens **`runMigrations`** en
**`runSeed`** uitvoert. De native module `better-sqlite3` blijft zo buiten de
edge-bundle van de middleware.

- **Migraties** komen uit `drizzle/` en zijn idempotent: Drizzle houdt in
  `__drizzle_migrations` bij wat al is toegepast, dus herstarten is veilig.
- **Seed** vult het standaardgrootboek (codes 0130–8010) en een boekjaar voor het
  huidige jaar (btw-periode kwartaal), maar alléén als de betreffende tabellen
  nog leeg zijn.
- De databaseconnectie (`src/db/index.ts`) zet **WAL-mode** en `foreign_keys =
  ON`, en maakt de datamap aan als die ontbreekt. Het pad komt uit
  **`DATABASE_PATH`** (standaard `./data/boekhouden.db`; in de container
  `/data/boekhouden.db`).

---

## Lokaal draaien (development)

Vereist Node.js 22.

```bash
npm install
cp .env.example .env      # vul minimaal SESSION_SECRET in (>= 32 tekens)
npm run dev
```

Open <http://localhost:3000>. Bij de eerste start migreert en seedt de app
zichzelf (standaardgrootboek + boekjaar voor het huidige jaar). Je wordt naar
`/setup` geleid om een wachtwoord en de bedrijfsnaam in te stellen.

Handige scripts:

```bash
npm run build        # productiebuild (output: standalone)
npm run lint         # ESLint
npm run test         # Vitest (unit tests, incl. de "gouden dataset")
npm run db:migrate   # migraties los draaien
npm run db:seed      # seed los draaien
```

## Deploy op een VPS (Docker Compose)

De app luistert binnen de container op poort 3000 en publiceert die op
`127.0.0.1:3000` — bereikbaar maken doe je via een reverse proxy met TLS.

### 1. Voorbereiden

```bash
git clone <repo> boekhouden && cd boekhouden

# Sessiesleutel van minstens 32 tekens genereren en in .env zetten:
echo "SESSION_SECRET=$(openssl rand -base64 48)" > .env
```

`.env` wordt door Docker Compose automatisch ingelezen. De database komt in
`./data/boekhouden.db` (het volume `./data:/data`), zodat data een herbouw of
herstart overleeft.

### 2. Starten

```bash
docker compose up -d --build
```

De container draait als non-root user `node` op een Alpine-image (multi-stage
build met `output: 'standalone'`; de native `better-sqlite3`- en argon2-modules
worden voor Alpine/musl gecompileerd en meegetraced). De healthcheck pollt
`/api/health`; controleer de status met:

```bash
docker compose ps          # STATUS moet "healthy" worden
curl -fsS http://127.0.0.1:3000/api/health   # {"status":"ok"}
```

Bijwerken naar een nieuwe versie:

```bash
git pull
docker compose up -d --build
```

Migraties draaien automatisch bij het opstarten; ze zijn idempotent.

### 3. Reverse proxy (Caddy)

Caddy regelt automatisch Let's Encrypt-certificaten. `Caddyfile`:

```caddyfile
boekhouden.example.nl {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

Een equivalente Nginx-`location` proxyt eveneens naar `http://127.0.0.1:3000`;
zorg dan zelf voor de TLS-certificaten (bijv. via certbot). Zorg dat de proxy een
correcte `X-Forwarded-For` doorgeeft — de rate limiter op de login gebruikt die
header om het client-IP te bepalen.

## Omgevingsvariabelen

| Variabele | Verplicht | Standaard | Uitleg |
|---|---|---|---|
| `SESSION_SECRET` | ja (productie) | — | Sleutel voor de versleutelde sessiecookie, **minstens 32 tekens**. Genereer met `openssl rand -base64 48`. In development valt de app terug op een onveilige sleutel met een waarschuwing. |
| `DATABASE_PATH` | nee | `/data/boekhouden.db` (image) | Pad naar het SQLite-bestand. In de container staat dit vast op het volume. |
| `AUTH_PASSWORD_HASH` | nee | — | Overschrijft de wachtwoord-hash uit de database (reset-mechanisme, zie onder). Wanneer gezet kan het wachtwoord niet via de app worden gewijzigd. |

## Back-up

De hele administratie zit in `./data/boekhouden.db`. Maak een **consistente**
back-up met `sqlite3 .backup` (veilig terwijl de app draait, ook met WAL-mode) —
kopieer het bestand dus niet zomaar met `cp`.

Voorbeeld van een back-upscript `/usr/local/bin/boekhouden-backup.sh` met
rotatie (14 dagen bewaren):

```bash
#!/usr/bin/env bash
set -euo pipefail

DB=/opt/boekhouden/data/boekhouden.db
DEST=/opt/boekhouden/backups
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$DEST"
# .backup maakt een consistente kopie, ook tijdens schrijfacties.
sqlite3 "$DB" ".backup '$DEST/boekhouden-$STAMP.db'"
gzip -f "$DEST/boekhouden-$STAMP.db"

# Rotatie: back-ups ouder dan 14 dagen verwijderen.
find "$DEST" -name 'boekhouden-*.db.gz' -mtime +14 -delete
```

Nachtelijke cron (elke nacht om 03:15):

```cron
15 3 * * * /usr/local/bin/boekhouden-backup.sh >> /var/log/boekhouden-backup.log 2>&1
```

Heb je `sqlite3` niet op de host, dan kun je hem in de container gebruiken:

```bash
docker compose exec app sh -c \
  "sqlite3 /data/boekhouden.db \".backup '/data/backup-$(date +%F).db'\""
```

**Terugzetten:** stop de app, vervang `data/boekhouden.db` door de (uitgepakte)
back-up en verwijder eventuele `-wal`/`-shm`-bestanden, start de app opnieuw:

```bash
docker compose down
gunzip -c backups/boekhouden-YYYYMMDD-HHMMSS.db.gz > data/boekhouden.db
rm -f data/boekhouden.db-wal data/boekhouden.db-shm
docker compose up -d
```

## Wachtwoord vergeten / resetten

Het wachtwoord staat als argon2id-hash in de `settings`-tabel. Resetten kan
zonder de database te bewerken via `AUTH_PASSWORD_HASH`: die hash wint bij het
inloggen van de opgeslagen hash.

1. Genereer een hash van je nieuwe wachtwoord. Bijvoorbeeld met de eigen
   hashfunctie van de app:

   ```bash
   docker compose exec app node -e \
     "require('@node-rs/argon2').hash('MijnNieuweWachtwoord',{algorithm:2}).then(h=>console.log(h))"
   ```

2. Zet de hash in `.env`:

   ```bash
   AUTH_PASSWORD_HASH=$argon2id$v=19$m=19456,t=2,p=1$...
   ```

3. Herstart en log in met het nieuwe wachtwoord:

   ```bash
   docker compose up -d
   ```

Laat je `AUTH_PASSWORD_HASH` gezet staan, dan blijft het wachtwoord vastgezet en
kan het niet via **Instellingen** worden gewijzigd. Wil je het beheer weer via de
app doen, verwijder de variabele dan nadat je (eventueel) in de app een nieuw
wachtwoord hebt ingesteld.

## Testen

De unit tests draaien met **Vitest**:

```bash
npm run test         # eenmalig
npm run test:watch   # watch-modus
```

Naast de losse tests voor `money.ts`, `dates.ts`, de Zod-schema's, de rate
limiter en de boekjaarkeuze is er een **gouden dataset** in
`src/lib/reports/reports.test.ts`. Die seedt een tijdelijke SQLite met een
handmatig narekenbare set (beginbalans Bank €5.000 / Beginkapitaal €5.000; drie
verkopen en drie inkopen) en controleert de rapportfuncties tegen met de hand
berekende verwachtingen, o.a.:

- **BTW**: 1a €1.000 / €210, 1b €500 / €45, voorbelasting 5b €240, te betalen €15.
- **W&V**: omzet €1.700, kosten €400, winst €1.300 (de via inkoop geboekte
  inventaris is een balanspost en telt niet mee).
- **Balans**: sluit (Bank €6.047, Debiteuren €545, Voorbelasting €240,
  Crediteuren €968, …), met het resultaat €1.300 als sluitpost.
- **Jaarafsluiting**: jaar N gaat op `gesloten`, N+1 krijgt een sluitende
  beginbalans met het resultaat verwerkt in `1400 Beginkapitaal`.

Omdat de rapportages pure functies zijn die tegen een echte (in-memory) SQLite
draaien, testen deze cases de volledige rekenketen zonder de UI of het netwerk.

## Licentie

Dit project is beschikbaar onder de [GNU Affero General Public License v3.0](LICENSE)
(AGPL-3.0). Je mag de software vrij gebruiken, aanpassen en verspreiden; bied je
een aangepaste versie aan als (online) dienst, dan moet je de broncode van die
versie onder dezelfde licentie beschikbaar stellen.
