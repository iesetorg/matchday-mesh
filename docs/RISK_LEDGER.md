# Risk Ledger

| Risk | Impact | Mitigation |
|---|---:|---|
| Pear release must be reproducible after future edits | Medium | Release succeeded for `pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy` at length `2413`. Re-run stage/release/seed after any launch-critical edit. |
| Pear CLI PATH is incomplete on this machine | Low | The shim exists at `/opt/homebrew/bin/pear`, but it warns to prepend `/Users/localllm/Library/Application Support/pear/bin`; that suggested directory is absent on this host. Functional released-link renderer proof still passes with `hasPear: true` and Corestore/Hyperbee backend. |
| Pear rejects legacy HTML entrypoints | High | Matchday Mesh now uses `index.cjs`, `pear.pre: pear-electron/pre`, `pear-electron`, and `pear-bridge` while keeping `index.html` as the renderer. |
| Runtime bridge proof must be refreshed after release packaging | Low | Dev-mode Pear renderer proof passes with `hasMatchdayAPI: true` and Corestore/Hyperbee operations. Re-run the proof after `pear stage` and release. |
| Live cross-device Hyperswarm pairing still needs visual field proof | Medium | Real Hyperswarm host/join proof now passes on the launch workstation: the hosted topic syncs a read-only replica and carries a live host append. Capture a two-device Pear Runtime screenshot when another host is available. |
| Dependency freshness drifts before release | Low | `package-lock.json` is generated, `npm ci --ignore-scripts` succeeds from the lockfile, and local `node_modules` now matches the declared top-level dependencies. Re-run `npm ci` before staging. |
| Catalog listing lags behind release | Low | Fresh-peer catalog verification passes, running desktop PearBrowser loaded `Tether Developers Cup Apps` with 1 app through its own RPC/catalog path, and `pearbrowser-catalog-visual-proof-2026-06-30.png` turns that live RPC evidence into a reviewer-friendly proof card. A native PearBrowser window screenshot remains optional because host screenshots are blocked here. |
| OS-level Pear window screenshots are blocked on this host | Low | `screencapture` returns `could not create image from display`; the released renderer now writes `pear-release-window-2026-06-30.png` as an honest renderer-generated proof card with Corestore/Hyperbee, invite, and pairing state. |
| Tester handoff drifts across separate commands | Low | `npm run verify:preview-smoke` covers the local try-it flow, and `npm run verify:launch` runs the judge gate, real Hyperswarm pairing, and live-readiness checks in one pass before writing a consolidated proof receipt. |
| DoraHacks page/video actions are outside the repo | Medium | `npm run verify:dorahacks` now verifies the technical packet and emits manual actions for DoraHacks page updates, unlisted YouTube demo upload, and optional two-device screenshot polish. |
| WDK integration slips | Medium | Ship deterministic demo-ledger mode and avoid claiming WDK unless the real adapter is passing. |
| QVAC integration slips | Medium | Keep QVAC gated and do not claim QVAC track until local SDK inference works. |
| UI scope grows | High | Freeze MVP to hub, pass, scan, feed, prediction, and pool. |
