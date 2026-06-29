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
7. Show the proof files in `docs/proof/`.

## Honest Track Scope

Primary track: Pears Stack.

The USDt pool is a deterministic WDK-shaped demo adapter. QVAC is gated until a
local QVAC SDK inference path is proven without cloud AI APIs. Hyperswarm UI and
full Autobase multiwriter sync are not claimed in this launch build; direct
Corestore replication from the invite is covered by tests, and the app displays
a stable `matchday-mesh-pairing-v1` Hyperswarm topic for the next public swarm
pairing step.
