# Matchday Mesh

Matchday Mesh is a PearBrowser-first football watch-party app for the Tether
Developers Cup. Hosts create match hubs, fans claim passes, door staff scan
check-ins, and everyone posts predictions and match notes into a local-first
watch-party feed.

The launch build is focused on Pears Stack readiness. WDK starts as a
deterministic USDt pool demo adapter, and QVAC remains gated until local QVAC SDK
inference is proven with no cloud AI API.

When launched through Pear Runtime, the renderer uses a `window.matchdayAPI`
bridge backed by Corestore/Hyperbee. The same UI falls back to `localStorage`
when opened through the local HTTP preview server.

The current Pears Stack proof includes direct Corestore replication from a host
operation log to a read-only peer opened by core key. Hyperswarm pairing is the
next publish gate. In Pear Runtime, the app exposes a P2P invite panel with the
host core key, operation count, and exportable invite JSON.

## Run Locally

```sh
npm ci
npm test
npm run validate:publish
npm run preview
```

With Pear CLI installed:

```sh
pear run --dev .
```

Released Pear link:

```text
pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy
```

Public source repository:

```text
https://github.com/iesetorg/matchday-mesh
```

For an automated renderer proof:

```sh
MATCHDAY_MESH_BOOT_PROOF_PATH=./matchday-pear-proof.json pear run --dev .
```

The proof file is ignored by Pear staging and the app `.gitignore`.

## Publish Path

The under-one-week goal is a live PearBrowser store listing by July 5, 2026,
with July 6 reserved for DoraHacks registration lock cleanup.

```sh
export PEAR_LINK=pear://...
npm run stage
npm run release
npm run seed
npm run validate:publish -- --strict-release
```

After release, update `scripts/app-manifest.json` with the final `pearRuntime`
link and public source repo URL, then run the strict publish validator.

## MVP Flow

- Create a match hub.
- Claim a fan pass.
- Scan/check in a pass.
- Post feed notes and predictions.
- Export the P2P invite from the match hub.
- Open a USDt pool demo card.
- Record demo contributions into the feed.
- Export the proof pack from the app header.

## Track Claims

- Pears Stack: primary launch track.
- WDK: claim only after the real WDK adapter path is passing, otherwise describe
  the pool as a WDK-shaped demo module.
- QVAC: claim only after local QVAC SDK inference runs on device without cloud
  AI.
