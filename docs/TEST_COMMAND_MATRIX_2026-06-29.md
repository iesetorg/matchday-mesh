# Test Command Matrix - 2026-06-29

Current app slice: PearBrowser-first local MVP with replayable operation log,
Corestore/Hyperbee runtime API, publish-surface validation, and local HTTP
preview fallback.

## Commands

Run from:

```sh
/Users/localllm/Projects/pear-ecosystem/02-apps/matchday-mesh
```

| Command | Result | Notes |
|---|---|---|
| `npm test` | Pass | 21/21 Node tests pass across domain, operation-log replay, payment adapter behavior, Corestore/Hyperbee persistence, invite validation, direct Corestore replication, pairing descriptor derivation, and the Pear renderer runtime API. |
| `npm run validate:publish` | Pass with release metadata present | `links.pearRuntime`, `links.pearBrowser`, and `links.sourceRepo` are all filled in for the public release. |
| `npm run validate:publish -- --strict-release` | Pass | Strict release validation reports `Matchday Mesh publish surface OK (0 warnings)`. |
| `npm run verify:demo-proof` | Pass | Deterministic demo proof is current and covers fan pass check-in, invite summary, prediction, reaction, USDt pool open, and 5 USDt contribution. |
| `npm run verify:live-readiness` | Pass | Local launch workstation check verifies release/catalog/demo proof freshness, preview server response, catalog serve process, and active Pear seed for the released app link. |
| `npm run handoff:judge` | Pass | Prints and verifies the released app link, PearBrowser catalog, public repo, release proof, deterministic demo proof, live-readiness proof, and judge quickstart references. |
| `npm run verify:submission` | Pass | Submission pack preflight verifies the released Pear link, live PearBrowser catalog key, source repo, proof JSON, proof screenshots, honest track language, and prior-work disclosure. |
| `npm run check` | Pass | Runs `npm test` and `npm run validate:publish`. |
| `npm run check:release` | Pass | Runs the full release/submission gate: `npm test`, strict publish validation, deterministic demo-proof verification, and submission-pack preflight. |
| `npm ci --ignore-scripts` | Pass | Clean install from `package-lock.json` added 157 packages and found 0 vulnerabilities. Local `node_modules` now matches the lockfile instead of the earlier Pear Home copy. |
| `npm ci --ignore-scripts` in `/private/tmp/matchday-mesh-ci-proof` | Pass | Fresh fixture with only `package.json` and `package-lock.json` installed successfully from the registry. |
| `npm ls --depth=0` | Pass | Top-level tree is clean: `b4a@1.8.0`, `corestore@6.18.4`, `hyperbee@2.27.3`, `hypercore-crypto@3.6.1`, `pear-bridge@1.2.5`, `pear-electron@1.7.28`. |
| `node --check ui/app.js` | Pass | UI module parses. |
| `node --check app/ops.js` | Pass | Operation-log module parses. |
| `node --check app/pears-store.js` | Pass | Corestore/Hyperbee operation-log store parses. |
| `node --check app/pears-sync.js` | Pass | Direct Corestore replication helper parses. |
| `node --check app/runtime-api.js` | Pass | Pear renderer runtime API wrapper parses. |
| `node --check app/boot-renderer.js` | Pass | Pear renderer bootstrap script parses. |
| `node --check index.cjs` | Pass | Modern Pear main process parses. |
| `node -e "console.log(require.resolve('pear-electron')); console.log(require.resolve('pear-bridge'))"` | Pass | Runtime deps resolve from `02-apps/matchday-mesh/node_modules`. |
| `npm run preview -- --port 4173` | Pass after sandbox escalation | Local server started at `http://127.0.0.1:4173/`. Initial sandboxed bind failed with `EPERM`, then succeeded with local-network approval. |
| `curl -sS http://127.0.0.1:4173/` | Pass | Served `index.html`. |
| `curl -sS http://127.0.0.1:4173/ui/app.js` | Pass | Served UI module. |
| `curl -sS http://127.0.0.1:4173/app/ops.js` | Pass | Served operation-log module. |
| In-app browser render smoke | Pass | Browser rendered `Matchday Mesh`, `Final Night Fan Zone`, 3 seeded feed cards, scanner, and pool form. |
| In-app browser click flow | Pass | Reset demo, scanned Ada pass, opened USDt pool, contributed 5 USDt. Result showed `Accepted`, `5.00 USDt / 50`, newest feed cards ordered as pool contribution, pool opened, check-in, reaction. |
| In-app browser payment adapter flow | Pass | Pool displayed `demo-usdt://matchday-mesh/...` receive address, rendered 49 QR cells, status showed `WDK-shaped demo receive path`, and top feed card was `pool-contribution`. |
| In-app browser P2P invite panel smoke | Pass | Preview mode shows the P2P invite panel with `Mode: Preview`, `Core: Launch in Pear`, disabled export button, and operation count updating from 3 to 6 after the demo flow. |
| In-app browser invite inspector flow | Pass | Pasted a released-link `matchday-mesh-core-invite-v1` invite, inspected it, and verified the summary showed `read-only`, `ops 3`, the short core key, and the short discovery key; invalid JSON showed `Invite must be valid JSON`. Proof saved at `docs/proof/matchday-mesh-invite-inspector-2026-06-30.jpg`. |
| In-app browser invite export harness | Pass | Pear-like runtime harness clicked `Export Invite` and verified the on-page textarea contained `matchday-mesh-core-invite-v1`, the summary showed `Invite ready to share.`, `read-only`, and `ops 3`, the pairing panel showed `hyperswarm-topic` plus short topic `2b6f3a25...36d0df`, and no alert dialog opened. Proof saved at `docs/proof/matchday-mesh-invite-export-panel-2026-06-30.jpg`. |
| In-app browser visual proof capture | Pass | Saved viewport proofs at `docs/proof/matchday-mesh-preview-2026-06-30.jpg` and `docs/proof/matchday-mesh-preview-flow-2026-06-30.jpg`; DOM assertions confirmed `Accepted`, `5.00 USDt / 50`, `Ops 6`, `Launch in Pear`, and `backendOps 6` with zero console errors. |
| `which pear` | Pass | Pear CLI shim exists at `/opt/homebrew/bin/pear`. |
| `pear --version` | Not supported | CLI exists but bailed with `UNKNOWN_FLAG: version`; also printed PATH warning. |
| `pear help` | Inconclusive | Hung after the PATH warning and was stopped. Use HTTP preview for current testing; retry Pear dev launch from a terminal with Pear's PATH fix. |
| `pear run --dev .` | Pass, running | Initial HTML-entrypoint build failed with `ERR_LEGACY`. After adding `index.cjs`, `pear.pre: pear-electron/pre`, `pear-electron`, and `pear-bridge`, Pear ran the pre-hook and stayed running. CLI still prints PATH and deprecation warnings. |
| `MATCHDAY_MESH_BOOT_PROOF_PATH=... pear run --dev .` | Pass | Renderer wrote `matchday-pear-proof.json` with `ok: true`, `hasPear: true`, `hasMatchdayAPI: true`, backend `pears-store`, Corestore/Hyperbee key/discovery key, a `matchday-mesh-core-invite-v1` invite, and 3 seeded operations from Pear storage. |
| `MATCHDAY_MESH_BOOT_PROOF_PATH=... pear run --dev .` after clean `npm ci` | Pass | Pear renderer proof still passes with the clean dependency tree. |
| `pear touch` | Pass | Created `pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy`. |
| `PEAR_LINK=... npm run stage` | Pass | Staged Matchday Mesh and warmed the app. Latest length reported as `1964` after the visible pairing panel update. |
| `pear stage --purge ...` | Pass | Removed accidentally staged ignored `pearbrowser-catalog-data/` publisher storage before release. |
| `PEAR_LINK=... npm run release` | Pass | Released `pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy`; final latest length reported as `1965` after the visible pairing panel update. |
| `pear info pear://9a5q...` | Pass | Pear reports `name matchday-mesh`, `release 1965`, `length 1965`, project key `fe36eb...3bca`, discovery key `e92e9f...91f9`, and content key `41328f...6b87`. |
| `PEAR_LINK=... npm run seed` | Running | Seed announced drive key `fe36eb9038630aeb0a8bc2a21f548d44964c35d9eaff37c654b95d9173233bca`, discovery key `e92e9f4a8df2ced0e5eb1b15354877097a4c1030b843154f8301fe694bdc91f9`, and content key `41328f560d68a5e50e1b45a22ecd3511fa5213c49a42a625170d7175834c6b87`. |
| `MATCHDAY_MESH_BOOT_PROOF_PATH=... pear run pear://9a5q...` | Pass | Final released-link renderer proof wrote `matchday-release-proof-1965-2026-06-30.json` with `ok: true`, `hasMatchdayAPI: true`, backend `pears-store`, a `matchday-mesh-core-invite-v1` invite, a `matchday-mesh-pairing-v1` Hyperswarm topic, and 3 seeded operations after release length `1965`. |
| `PATH=".../pear/bin:$PATH" MATCHDAY_MESH_BOOT_PROOF_PATH=... pear run pear://9a5q...` | Pass with warning | Released-link renderer proof still passed with `hasPear: true`, `hasMatchdayAPI: true`, Corestore/Hyperbee backend, `matchday-mesh-core-invite-v1`, and `matchday-mesh-pairing-v1`. The Pear shim warning persisted because the suggested `/Users/localllm/Library/Application Support/pear/bin` directory does not exist on this host. Proof saved at `docs/proof/pear-release-renderer-proof-2026-06-30.json`. |
| `node --test test/pears-sync.test.js` | Pass | Host Corestore replicated the Hyperbee operation log to a read-only peer by core key; a live appended feed card reached the peer. |
| `gh repo create matchday-mesh --public --source . --remote origin --push` | Pass | Created and pushed the public source repo at `https://github.com/iesetorg/matchday-mesh`. |
| `node scripts/publish-catalog-bee.js ... --no-pin` | Pass | Built a signed PearBrowser Hyperbee catalog from `catalog/matchday-mesh.catalog.json`: `hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f`. |
| `node scripts/publish-catalog-bee.js ... --serve` | Running | Published the same catalog, announced it on swarm, and received 5 HiveRelay seed acceptances before staying online to serve the catalog. |
| `node scripts/verify-live-catalog.js --key 0ba0... --expect-app matchday-mesh --expect-count 1 --expect-name "Tether Developers Cup Apps"` | Pass | Fresh-peer PearBrowser catalog verification found 3 peers, updated the catalog core to length 9, read signed `\x00meta`, and confirmed the `matchday-mesh` row. |
| `node scripts/release-rpc-story-smoke.mjs --catalog 0ba0... --timeout 60000 --request-timeout 80000 --json` in PearBrowser repo | Pass | Running desktop PearBrowser loaded the Matchday Mesh Hyperbee catalog through its own RPC/catalog path: DHT connected, 11 peers, 11 HiveRelays, `Tether Developers Cup Apps` loaded with 1 app, and 15 apps aggregated across 3 catalogues. Proof saved at `docs/proof/pearbrowser-desktop-catalog-rpc-2026-06-30.json`. |

## Current Preview

The preview server was started on:

```text
http://127.0.0.1:4173/
```

If it is not running anymore:

```sh
npm run preview -- --port 4173
```

## Coverage

The automated tests currently prove:

- match hub creation creates a system feed card;
- fan pass claim is idempotent per writer;
- check-in scan is idempotent;
- prediction conflict rule allows one prediction per writer per match hub;
- pool contribution creates a USDt feed card;
- proof pack exports app/version/status counts;
- operation log replays to deterministic state;
- duplicate operation IDs do not duplicate state;
- operation envelope export/import works;
- conflicting predictions fail during replay.
- WDK-shaped demo receive requests produce `demo-usdt://` QR payloads;
- real WDK mode is explicitly refused until the SDK path is enabled;
- demo contribution receipts record through the domain payment path.
- Corestore/Hyperbee persistence appends operation envelopes in order;
- reopening the same storage path preserves the operation log and core key;
- Hyperbee `op-id!{id}` index deduplicates operation ids.
- Hyperbee operation log clearing resets sequence state and supports demo reseed.
- direct Corestore replication sends the host operation log to a read-only peer
  opened from a normalized `matchday-mesh-core-invite-v1` and catches up after
  new host appends.
- the same Matchday invite derives a stable `matchday-mesh-pairing-v1`
  descriptor with a 32-byte Hyperswarm topic for the next public pairing path.
- Pear runtime invite export returns the host core key and discovery key as a
  `matchday-mesh-core-invite-v1` object, derives the visible
  `matchday-mesh-pairing-v1` Hyperswarm topic, and malformed invites are
  rejected before opening a replica.
- Pear renderer runtime API resets, appends, reports store info, and replays
  state through the Corestore/Hyperbee path.
- released Pear link renderer proof passes even though the local Pear shim
  warning remains unresolved on this host.
- clean install from `package-lock.json` recreates the dependency tree used by
  tests and Pear dev proof.
- PearBrowser's live Hyperbee catalog verification can discover the catalog by
  key, read signed metadata, and find the released `matchday-mesh` store row.
- visual browser proof captures preserve the top hub flow and lower feed/USDt
  pool state used for the submission demo pack.
- browser harness proof confirms the Pear-runtime invite export fills the
  on-page handoff and pairing panels instead of relying on an alert dialog.
- deterministic demo proof replays the submission flow and asserts Pears Stack
  ops, read-only invite handoff, door check-in, and demo USDt contribution.
- live-readiness proof confirms the local preview, catalog server, and Pear seed
  are online before recording or handing the app to a tester.
- judge handoff verifies the exact links and proof files a reviewer needs to
  run the released Pear app and local test suite.
- running desktop PearBrowser can load the live Matchday Mesh Hyperbee catalog
  through its own Apps/catalog RPC path.

## Remaining Gates

- Pear runtime launch without the local shim warning; functional released-link
  proof passes, but Pear's suggested bin directory is absent on this host.
- Visual Pear window screenshot showing Corestore/Hyperbee in the status panel.
- Optional visual PearBrowser store listing screenshot; the nonvisual desktop
  PearBrowser catalog RPC proof now verifies the live listing path.
