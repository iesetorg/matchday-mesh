# Risk Ledger

| Risk | Impact | Mitigation |
|---|---:|---|
| Pear release must be reproducible after future edits | Medium | Release succeeded for `pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy` at length `1965`. Re-run stage/release/seed after any launch-critical edit. |
| Pear CLI PATH is incomplete on this machine | Low | The shim exists at `/opt/homebrew/bin/pear`, but it warns to prepend `/Users/localllm/Library/Application Support/pear/bin`; that suggested directory is absent on this host. Functional released-link renderer proof still passes with `hasPear: true` and Corestore/Hyperbee backend. |
| Pear rejects legacy HTML entrypoints | High | Matchday Mesh now uses `index.cjs`, `pear.pre: pear-electron/pre`, `pear-electron`, and `pear-bridge` while keeping `index.html` as the renderer. |
| Runtime bridge proof must be refreshed after release packaging | Low | Dev-mode Pear renderer proof passes with `hasMatchdayAPI: true` and Corestore/Hyperbee operations. Re-run the proof after `pear stage` and release. |
| Public Hyperswarm join UI is not implemented yet | Medium | Direct Corestore replication from the exported invite is covered by tests, and the Pear invite panel now derives and displays a stable `matchday-mesh-pairing-v1` Hyperswarm topic. Build the public swarm join UI on top of that descriptor if time allows. |
| Dependency freshness drifts before release | Low | `package-lock.json` is generated, `npm ci --ignore-scripts` succeeds from the lockfile, and local `node_modules` now matches the declared top-level dependencies. Re-run `npm ci` before staging. |
| Catalog listing lags behind release | Low | Fresh-peer catalog verification passes, and running desktop PearBrowser loaded `Tether Developers Cup Apps` with 1 app through its own RPC/catalog path. A macOS screenshot remains optional because `screencapture` failed on this host. |
| WDK integration slips | Medium | Ship deterministic demo-ledger mode and avoid claiming WDK unless the real adapter is passing. |
| QVAC integration slips | Medium | Keep QVAC gated and do not claim QVAC track until local SDK inference works. |
| UI scope grows | High | Freeze MVP to hub, pass, scan, feed, prediction, and pool. |
