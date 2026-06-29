# Proof Captures

Visual proof captured from the local in-app browser preview on 2026-06-30.

| File | Shows | Checks |
|---|---|---|
| `matchday-mesh-preview-2026-06-30.jpg` | Top of the PearBrowser launch build: app title, tracks, hub selection, create-hub form, and invite card. | DOM contained `Matchday Mesh`, `Final Night Fan Zone`, Ada fan pass, and checked-in state. |
| `matchday-mesh-preview-flow-2026-06-30.jpg` | Feed, pool contribution, USDt pool, receive URI, and QR cells. | DOM contained `Accepted`, `Ada contributed 5 USDt`, `5.00 USDt / 50`, `Launch in Pear`, `Ops 6`, and `backendOps 6`; console errors were empty. |
| `matchday-mesh-invite-inspector-2026-06-30.jpg` | P2P invite inspector with a released-link invite pasted into the UI. | DOM contained `matchday-mesh-core-invite-v1`, the short core key, the short discovery key, `ops 3`, and `read-only`; console errors were empty. |
| `pearbrowser-desktop-catalog-rpc-2026-06-30.json` | Running desktop PearBrowser loaded the live Hyperbee catalog. | RPC status was DHT-connected with 11 peers and 11 HiveRelays; loaded `Tether Developers Cup Apps` with 1 app and 15 aggregated apps total. |
| `pear-release-renderer-proof-2026-06-30.json` | Released Pear link launched and wrote renderer proof for release `1944`. | `hasPear` and `hasMatchdayAPI` were true, backend was Corestore/Hyperbee, and the invite type was `matchday-mesh-core-invite-v1`; Pear's shim warning persisted because the suggested bin directory is absent on this host. |
