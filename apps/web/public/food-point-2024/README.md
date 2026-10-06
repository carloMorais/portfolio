# Food Point, frontend of 2024

The `public/` folder of github.com/carloMorais/food-point at commit f1b2dfc
(a copy of the Alpha EdTech group 06 project, April–May 2024), unchanged,
without `assets/uploads/` (pictures users uploaded).

The portfolio demo loads it through `../food-point-demo/index.html`, the same
file plus one script (`shim.js`) that sends the requests to `/api` to a server
simulated in the browser (`src/components/food-point/server.ts`). Next.js
rewrites `/assets/*` and `/js/*` to this folder (`next.config.ts`), because the
app asks for its files at the root.
