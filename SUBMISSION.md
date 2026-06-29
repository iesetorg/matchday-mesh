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
Corestore invite so a read-only peer can follow the match operation log by key.

## What Is New During The Event

This app is a new football-specific product assembled during the Tether
Developers Cup window. It adapts known ecosystem patterns from Pear Tickets,
Pear POS, and PearBrowser publishing tools, with all reuse disclosed in
`PRIOR_WORK.md`.

## Setup

```sh
npm test
npm run validate:publish
pear run --dev .
```

## Known Limits

- The first build has a Pear Runtime API backed by Corestore/Hyperbee, with
  browser `localStorage` fallback for preview. Direct Corestore replication is
  proven in tests; Hyperswarm pairing and full Autobase multiwriter sync are
  still gated.
- The USDt pool starts in deterministic demo-ledger mode.
- QVAC local coach is disabled until QVAC SDK inference is proven locally.
- No live sports data API is required for the demo.

## Demo Script

See `docs/DEMO_SCRIPT.md`.

## Current Proof

See `docs/TEST_COMMAND_MATRIX_2026-06-29.md`.
