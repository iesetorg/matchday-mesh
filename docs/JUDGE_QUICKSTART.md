# Judge Quickstart

This is the shortest path for a reviewer or teammate to test Matchday Mesh.

## Released App

```sh
pear run pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy
```

Expected first screen: `Matchday Mesh`, `Final Night Fan Zone`, Pears status,
fan pass, door scan, watch-party feed, USDt pool, and P2P invite panels.

## PearBrowser Catalog

```text
hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f
```

The catalog name is `Tether Developers Cup Apps` and it contains the
`matchday-mesh` row pointing to the released Pear app.

## Source Checkout

```sh
git clone https://github.com/iesetorg/matchday-mesh
cd matchday-mesh
npm ci
npm run check:release
```

For the launch workstation, with the preview server, catalog server, and Pear
seed already running:

```sh
npm run verify:launch
npm run verify:dorahacks
npm run verify:preview-smoke
npm run verify:release-window
npm run verify:live-pairing
npm run verify:live-readiness
npm run handoff:judge
```

## Demo Flow

1. Open the released Pear app or the local preview.
2. Select `Final Night Fan Zone`.
3. Scan Ada's fan pass and confirm the door state changes to `Accepted`.
4. Post a prediction and a match note.
5. Open `Host snacks pool`, add Ada's 5 USDt demo contribution, and confirm the
   newest feed card records the contribution.
6. Export or inspect the P2P invite and confirm it is
   `matchday-mesh-core-invite-v1`, read-only, backed by Corestore/Hyperbee,
   and paired with a `matchday-mesh-pairing-v1` Hyperswarm topic.
7. Click `Host Pairing`, paste the invite into another Pear Runtime instance,
   then click `Join Replica` and confirm the joined replica is read-only. The
   automated `npm run verify:live-pairing` proof exercises the same host/join
   path over real Hyperswarm.
8. Show the proof files in `docs/proof/`.

The same local-preview reset, scan, pool-open, and contribution path is covered
by `npm run verify:preview-smoke`.

## Honest Track Scope

Primary track: Pears Stack.

The USDt pool is a deterministic WDK-shaped demo adapter. QVAC is gated until a
local QVAC SDK inference path is proven without cloud AI APIs. Full Autobase
multiwriter sync is not claimed in this launch build; direct Corestore
replication from the invite is covered by tests, and the app can host/join a
read-only replica over the displayed `matchday-mesh-pairing-v1` Hyperswarm
topic.
