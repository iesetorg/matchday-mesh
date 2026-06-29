# Matchday Mesh Architecture

The first launch build keeps the implementation small enough to publish quickly:

- `app/domain.js` owns the pure product model.
- `app/ops.js` owns the replayable operation log that mirrors the future
  Autobase append/apply contract.
- `app/payments.js` owns the WDK-shaped payment adapter boundary. The first
  launch build uses demo-ledger mode and refuses to claim real WDK mode until
  the SDK path is enabled.
- `app/pears-store.js` persists the same operation envelopes in a
  Corestore-backed Hyperbee so the local model is already shaped for Pears
  Stack replication.
- `app/pears-sync.js` connects two Matchday Mesh Corestores with replication
  streams and waits for a read-only peer to receive the operation log.
- `app/runtime-api.js` exposes the Pear renderer API over the Hyperbee store:
  list operations, append one operation, reset/reseed, replay, info, invite,
  and close.
- `app/boot-renderer.js` detects Pear Runtime, opens the runtime API with
  `Pear.config.storage`, and installs it as `window.matchdayAPI`.
- `index.cjs` is the current Pear Runtime main process. It boots
  `pear-electron` with a `pear-bridge` pipe so Pear no longer treats the app as
  a legacy HTML entrypoint.
- `ui/app.js` renders the PearBrowser interface. It prefers
  `window.matchdayAPI` when launched in Pear and falls back to `localStorage`
  for normal browser preview.
- `scripts/app-manifest.json` describes the catalog listing.
- `scripts/validate-publish-surface.mjs` protects the app-store surface.

## Product Model

The model has five core collections:

- match hubs;
- fan passes;
- feed cards;
- predictions;
- USDt pool/payment records.

The current local model is intentionally shaped so it can move into Hyperbee and
Autobase apply handlers without changing the UI contract.

## Operation Log

The UI appends operations such as `match:create`, `pass:claim`,
`prediction:post`, and `pool:contribute`. On startup, it replays the full log to
rebuild state. In Pear Runtime, that log is loaded from the Hyperbee-backed
runtime API. In browser preview, the same envelopes are stored in
`localStorage`.

The backend proof in `app/pears-store.js` writes those same operation envelopes
to a Hyperbee over Corestore using:

- `op!{seq}!{id}` for ordered replay;
- `op-id!{id}` for idempotent duplicate detection;
- `meta!seq` for the next append sequence.

The runtime API also supports clearing and reseeding the log, which keeps the
demo reset flow honest in both preview mode and Pear mode.

## Replication Proof

`app/pears-sync.js` proves the first peer-to-peer path without relying on a
public DHT in tests:

- the host opens the named writable operation core;
- the guest opens the host core by key as read-only;
- the two Corestores replicate over paired protocol streams;
- the guest replays the replicated Hyperbee log into the same domain state;
- new host operations replicate after the connection is already open.

This is the deterministic base for a later Hyperswarm pairing UI.

The Pear runtime UI also exposes a `matchday-mesh-core-invite-v1` object with
the host core key and discovery key. The current invite is enough for the
read-only replication proof and gives the demo a visible P2P artifact before
Hyperswarm pairing is added.

## Payment Boundary

Pool creation requests a receive address through `app/payments.js`. In the
current build, the address is a `demo-usdt://` URI and contributions produce
demo receipts. The rest of the app only sees a receive request and contribution
receipt, which keeps the future WDK swap small.

## Feed Types

- `feed:system`
- `feed:checkin`
- `feed:prediction`
- `feed:reaction`
- `feed:pool-opened`
- `feed:pool-contribution`

Additional detailed feed types are mapped in the rollout product document.

## PearBrowser Release Path

The app packages as a Pear GUI app with `index.html` as its entrypoint. Release
proof should capture:

- `PEAR_LINK`;
- stage/release/seed command output;
- final `pearRuntime` link in `scripts/app-manifest.json`;
- PearBrowser store screenshot;
- app-open screenshot;
- fresh demo flow proof.
