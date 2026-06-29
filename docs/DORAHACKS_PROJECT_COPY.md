# DoraHacks Project Copy

## Title

Matchday Mesh

## Short Description

Serverless football watch parties for PearBrowser: P2P match hubs, fan passes,
QR check-ins, prediction feeds, and USDt pool cards.

## Track

Primary: Pears Stack.

WDK and QVAC are intentionally not claimed as primary tracks in the launch
submission. The build includes a WDK-shaped demo ledger for USDt pool UX and a
gated QVAC module placeholder, but those become track claims only after the real
SDK paths pass locally.

## Long Description

Matchday Mesh turns a football match into a local-first fan zone. A host creates
a match hub, fans claim passes, door staff scan check-ins, and everyone posts
predictions or match notes into a watch-party feed. The app is built for the
global tournament moment: stadium queues, watch parties, pub nights, supporter
clubs, and fan groups that need coordination without a central event server.

The Pear Runtime build uses a `window.matchdayAPI` bridge backed by
Corestore/Hyperbee. The UI can export a match invite containing the host core
key, discovery key, and a deterministic Hyperswarm pairing topic. Tests prove
direct Corestore replication and a hosted-topic Join Replica path from a host
operation log to a read-only peer opened from that invite. The launch proof also
hosts the pairing topic over real Hyperswarm, joins a read-only replica, appends
a live feed card, and verifies the replica catches up. A deterministic USDt pool
demo module shows the intended WDK receive/contribution UX while avoiding any
production-money claim before the real WDK adapter is proven.

## Links

- Source: `https://github.com/iesetorg/matchday-mesh`
- Pear app:
  `pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy`
- PearBrowser catalog:
  `hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f`
- License: MIT

## Setup

```sh
npm ci
npm test
npm run validate:publish -- --strict-release
npm run verify:demo-proof
npm run verify:launch
npm run verify:dorahacks
npm run verify:preview-smoke
npm run verify:release-window
npm run verify:live-pairing
npm run handoff:judge
npm run verify:submission
pear run --dev .
```

Local browser preview:

```sh
npm run preview -- --port 4173
```

## Proof

- `npm test`: 23/23 tests pass.
- `npm run validate:publish -- --strict-release`: 0 warnings.
- Released Pear link renderer proof passed with Corestore/Hyperbee backend.
- Released Pear renderer visual proof produced a PNG from inside the live Pear
  renderer; OS desktop screenshot capture is blocked on this host, so the image
  is honestly marked as a renderer proof-card fallback.
- Fresh-peer catalog verification found the signed `matchday-mesh` row.
- Running desktop PearBrowser loaded `Tether Developers Cup Apps` through its
  own Apps/catalog RPC path with 11 peers and 11 HiveRelays.
- Browser proof shows the P2P invite panel exporting a released-link invite,
  hosting the pairing topic, and joining a read-only replica handoff.
- Preview smoke proof starts the local HTTP preview, verifies the served UI
  assets, and replays the reset, scan, USDt pool, and contribution path.
- Live Hyperswarm proof shows a hosted topic, read-only replica join, and live
  replicated feed append.
- Launch rehearsal proof runs DoraHacks readiness, the judge gate, released
  window proof, live pairing, and live-readiness checks as one tester-facing
  command.
- DoraHacks readiness proof verifies the technical submission checklist and
  lists manual page/video actions still outside the repo.
- Deterministic demo proof replays the full fan-pass, invite, prediction, and
  USDt pool contribution flow.
- `docs/JUDGE_QUICKSTART.md` gives reviewers the shortest run/test path.
- Visual proof captures are in `docs/proof/`.

## Prior Work

The project is new for the Tether Developers Cup. Reused ecosystem patterns are
disclosed in `PRIOR_WORK.md`: Pear Tickets event/pass/check-in patterns, Pear
POS payment-adapter direction, anonGPT QVAC direction, and PearBrowser
catalog/publish tooling.

## Demo Video Outline

1. Open with the Pear app link and PearBrowser catalog key.
2. Show the status strip: Pears Stack primary, WDK demo, QVAC gated.
3. Create a final-night fan zone.
4. Claim Ada's fan pass and show the QR-style pass block.
5. Scan the pass and show the accepted/check-in state.
6. Post a prediction and a match note.
7. Export the P2P invite, host the pairing topic, and join a read-only replica.
8. Open a USDt pool demo, add a contribution, and show the feed card.
9. Show the deterministic demo proof, proof pack, and public repo.
