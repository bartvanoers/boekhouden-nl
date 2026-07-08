# Boekhouden

Een self-hosted webapplicatie voor de eigen boekhouding — de opvolger van de
Excel-template van boekhouden.nl. Eén administratie, meerdere boekjaren,
enkelvoudige login. Draait als één Docker-container met een SQLite-database op
een volume.

**Buiten scope:** facturen maken, Excel-import, e-Boekhouden-export, meerdere
gebruikers of administraties, bankkoppelingen.

## Functionaliteit

- **Verkopen & inkopen** — één register per richting met datum, soort
  (factuur/bonnetje/overig), factuurnummer, omschrijving, relatie, bedrag excl.
  btw, btw-tarief (21% / 9% / geen), status (bank / kas / openstaand) en
  grootboekcategorie. Live btw-berekening bij invoer, overschrijfbaar voor
  afwijkende bonnetjes.
- **Relaties** — klanten en leveranciers.
- **Grootboek** — standaardschema (0130 t/m 8010); systeemrekeningen zijn
  vergrendeld, overige rekeningen kunnen worden gedeactiveerd.
- **Beginbalans** — per balansrekening, met live activa = passiva-controle.
- **BTW-overzicht** — per maand, kwartaal of jaar (rubrieken 1a / 1b / 0% en
  voorbelasting 5b), met export.
- **Dashboard** — totalen per richting, winst & verlies, balans en btw-stand.
- **Jaarafsluiting** — eindbalans wordt overgedragen naar een nieuw boekjaar
  (resultaat naar Beginkapitaal); het afgesloten jaar wordt read-only.
- **Export** — CSV (`;`-gescheiden, met BOM voor NL-Excel) en XLSX van
  transacties, btw, winst & verlies en balans.

## Technische kern

- **Next.js 15** (App Router, React Server Components) + **TypeScript**.
- **SQLite** via **better-sqlite3** + **Drizzle ORM**; WAL-mode, migrate + seed
  bij het opstarten (`src/instrumentation.ts`).
- **Tailwind CSS + shadcn/ui**; alle teksten in het Nederlands.
- **iron-session** (versleutelde cookie) + **argon2id** voor authenticatie.
- Geld wordt altijd als gehele **centen** opgeslagen; datums als TEXT
  `YYYY-MM-DD`.

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

De container draait als non-root user `node` op een Alpine-image. De
healthcheck pollt `/api/health`; controleer de status met:

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
zorg dan zelf voor de TLS-certificaten (bijv. via certbot).

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
