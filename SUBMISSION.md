# Matchday Mesh Submission Draft

## Track

Primary track: Pears Stack.

Secondary WDK and QVAC claims are gated by working proof. The July 6 lock should
only include tracks that the live build can run honestly.

## Football Theme

Matchday Mesh turns a football match into a serverless fan zone. A host creates
a match hub, fans claim passes, check in at the door, post predictions, and join
a watch-party feed. Optional pool cards let the group coordinate USDt
contributions for hosts or creators. In Pear Runtime, the hub exposes a
Corestore invite and pairing topic so a read-only peer can follow the match
operation log by key.

## What Is New During The Event

This app is a new football-specific product assembled during the Tether
Developers Cup window. It adapts known ecosystem patterns from Pear Tickets,
Pear POS, and PearBrowser publishing tools, with all reuse disclosed in
`PRIOR_WORK.md`.

## Setup

```sh
npm ci
npm test
npm run validate:publish
npm run handoff:judge
pear run --dev .
```

Public source: https://github.com/iesetorg/matchday-mesh

Released Pear link:
`pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy`

PearBrowser catalog:
`hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f`

## Known Limits

- The first build has a Pear Runtime API backed by Corestore/Hyperbee, with
  browser `localStorage` fallback for preview. Direct Corestore replication is
  proven in tests, and the invite panel displays the deterministic
  `matchday-mesh-pairing-v1` Hyperswarm topic. The runtime can host that topic
  and join a read-only replica from a pasted invite. Real Hyperswarm host/join
  proof now verifies a live host append replicating to the read-only peer; full
  Autobase multiwriter sync is still gated.
- The USDt pool starts in deterministic demo-ledger mode.
- QVAC local coach is disabled until QVAC SDK inference is proven locally.
- No live sports data API is required for the demo.

## Demo Script

See `docs/DEMO_SCRIPT.md`.

## Judge Quickstart

See `docs/JUDGE_QUICKSTART.md`.

## Current Proof

See `docs/TEST_COMMAND_MATRIX_2026-06-29.md`.

Highlights:

- released Pear app:
  `pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy`;
- released Pear renderer visual proof:
  `docs/proof/pear-release-window-2026-06-30.png`;
- public source:
  `https://github.com/iesetorg/matchday-mesh`;
- live PearBrowser catalog:
  `hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f`;
- fresh-peer catalog verification found the `matchday-mesh` row;
- running desktop PearBrowser loaded the same catalog through its own
  Apps/catalog RPC path.
- preview smoke proof verifies the local test path: served UI assets, Ada scan,
  USDt pool open, 5 USDt contribution, and newest feed card.
- real Hyperswarm pairing proof joined a read-only replica and caught a live
  host feed append.
- launch rehearsal proof ran DoraHacks readiness, the judge gate, released
  window proof, live pairing, and live-readiness checks together.
- DoraHacks readiness proof verifies track scope, public links, license, setup,
  release/catalog/P2P proofs, prior-work disclosure, and manual video actions.

## DoraHacks Copy

See `docs/DORAHACKS_PROJECT_COPY.md` for paste-ready title, short description,
long description, setup steps, proof links, and demo-video outline.
