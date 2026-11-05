# Independent stock sanctuary / Vercel preview

The maintained source is the separate `../stock-sanctuary` checkout. The host imports no Unity/server source. `public/sanctuary-web` is an exported release, including its tested Unity build; do not hand-edit generated files.

- `/sanctuary/005930` redirects to the bundled `/sanctuary-web/rooms/KRX/005930` when `SANCTUARY_ORIGIN` is unset.
- `/sanctuary-web` is the searchable lobby.
- Vercel preview supports 3D, ritual controls, sound, timers and opt-in browser-local records.
- Shared guestbook and visitor counts are explicitly unavailable; no SQLite server is deployed on Vercel and no visitor numbers or saved public messages are fabricated.
- `SANCTUARY_ORIGIN=https://your-sanctuary.example` switches entry links to the independently hosted full Node/SQLite service. Explicit loopback HTTP is permitted for development only.
- Invalid configured origins fail closed to a setup page. No user is automatically sent to their own localhost.
- Link payload: market/ticker only, never portfolio ID, holdings, religion or login tokens.
- Unknown catalog entries show an error instead of inventing a room.

## Release

After committing the independent source and verifying its Unity build:

```sh
python3 ../stock-sanctuary/scripts/export-static.py public/sanctuary-web
npm test
npm run build
# Run against a started server or the actual production URL:
node scripts/verify-sanctuary-entry.mjs https://kr-portfolio-garden.vercel.app
node scripts/verify-sanctuary.mjs https://kr-portfolio-garden.vercel.app
```

Review `public/sanctuary-web/release.json`: source revision, clean/dirty state and per-file SHA-256. Keep `next.config.ts` rewrites/gzip MIME headers with the release. Git main is connected to the existing Vercel project; no additional paid service is provisioned.

The browser check uses a fresh context: real Unity load, four modes, ritual/bow counts, a one-minute timer, pause/resume, local-record save/delete, mobile-width layout, and lobby navigation. Real phone memory/performance and final artwork remain outside this preview verification.
