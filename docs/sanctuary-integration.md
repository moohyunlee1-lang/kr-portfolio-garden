# Independent stock sanctuary

Host changes are limited to a stock-detail entry link and a server-side redirect.
The separate checkout is `../stock-sanctuary`. It is not imported by this app.

- Start the sanctuary with `npm start` from that checkout (Node >=24).
- Start Groobat normally with `npm run dev`. Development defaults to `http://127.0.0.1:8787`.
- For `next start` or a deployed host, set `SANCTUARY_ORIGIN=https://your-sanctuary.example` in the server environment. For local production testing explicitly use `http://127.0.0.1:8787`.
- Missing/invalid production configuration shows an honest setup page; it never redirects a visitor to their own localhost.
- Origin only: no path prefix, query, credentials, or fragment. HTTPS required except loopback.
- Entry: `/sanctuary/005930` -> `${SANCTUARY_ORIGIN}/rooms/KRX/005930`.
- Payload: KRX ticker only. No portfolio ID, holdings, religion, return URL, or login token.
- The sanctuary validates against its own committed stock catalog. Unknown stocks show a 404 rather than creating unverified rooms.
- Religion/ritual choice stays in the sanctuary browser and Unity runtime. It is not a Groobat profile field.
- Independent deployments need only an origin change here. No Unity artifacts in this repo.
- No public deployment, remote push, billing setup, or identity federation is included.
