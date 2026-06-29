# Proof Captures

Proof captures from the local browser preview, released Pear renderer, live
Hyperswarm checks, and PearBrowser catalog path on 2026-06-30.

| File | Shows | Checks |
|---|---|---|
| `matchday-mesh-preview-2026-06-30.jpg` | Top of the PearBrowser launch build: app title, tracks, hub selection, create-hub form, and invite card. | DOM contained `Matchday Mesh`, `Final Night Fan Zone`, Ada fan pass, and checked-in state. |
| `matchday-mesh-preview-flow-2026-06-30.jpg` | Feed, pool contribution, USDt pool, receive URI, and QR cells. | DOM contained `Accepted`, `Ada contributed 5 USDt`, `5.00 USDt / 50`, `Launch in Pear`, `Ops 6`, and `backendOps 6`; console errors were empty. |
| `matchday-mesh-invite-inspector-2026-06-30.jpg` | P2P invite inspector with a released-link invite pasted into the UI. | DOM contained `matchday-mesh-core-invite-v1`, the short core key, the short discovery key, `ops 3`, and `read-only`; console errors were empty. |
| `matchday-mesh-invite-export-panel-2026-06-30.jpg` | P2P invite export fills the on-page textarea, pairing host panel, and joined replica panel. | Browser harness with a Pear-like runtime clicked `Export Invite` and `Join Replica`; DOM contained `Replica joined from invite.`, invite JSON, `read-only`, `ops 3`, `hyperswarm-topic`, `hosting`, `joined`, and the short pairing topic, with no console errors. |
| `pearbrowser-desktop-catalog-rpc-2026-06-30.json` | Running desktop PearBrowser loaded the live Hyperbee catalog. | RPC status was DHT-connected with 11 peers and 11 HiveRelays; loaded `Tether Developers Cup Apps` with 1 app and 15 aggregated apps total. |
| `pear-release-renderer-proof-2026-06-30.json` | Released Pear link launched and wrote renderer proof for release `2394`. | `hasPear` and `hasMatchdayAPI` were true, backend was Corestore/Hyperbee, the invite plus `matchday-mesh-pairing-v1` topic were exported, and visual proof metadata points at the renderer-generated PNG; Pear's shim warning persisted because the suggested bin directory is absent on this host. |
| `pear-release-window-2026-06-30.png` | Pear Runtime visual proof generated inside the released renderer. | Shows release-runtime state from the live Pear renderer: Corestore/Hyperbee backend, Pear/API readiness, operation count, invite core/discovery keys, pairing topic, and the screen-capture fallback reason. |
| `dorahacks-readiness-2026-06-30.json` | Technical DoraHacks readiness checklist. | Verifies track scope, football theme, public links, MIT license, setup instructions, release/catalog/P2P proofs, prior-work disclosure, demo-video plan, and lists manual page/video actions still outside the repo. |
| `matchday-demo-flow-proof-2026-06-30.json` | Deterministic replay of the demo video flow. | Replays 8 operations, summarizes the released-link invite handoff, derives a `matchday-mesh-pairing-v1` Hyperswarm topic, proves Ada checked in, and records a 5 USDt demo pool contribution. |
| `matchday-live-pairing-2026-06-30.json` | Real Hyperswarm host/join proof on the launch workstation. | Hosted the deterministic pairing topic, joined a read-only replica through Hyperswarm, appended a live feed card on the host, and verified the replica caught up to 4 operations. |
| `matchday-live-readiness-2026-06-30.json` | Local live-readiness proof for the launch workstation. | Confirms release metadata, catalog proof, deterministic demo proof, local preview response, catalog serve process, and active Pear seed for the released link. |
| `matchday-launch-rehearsal-2026-06-30.json` | Consolidated launch rehearsal receipt. | Ran release-window verification, `npm run check:judge`, real Hyperswarm pairing, and live-readiness in one pass, then summarized release, catalog, demo, pairing, and readiness proof status. |
