# Final Submission Runbook

Use this runbook for the final DoraHacks page update and the 3-minute demo
recording. It is intentionally operational: run the commands, record the shots,
then paste the links.

## Current Live Surface

- Pear app:
  `pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy`
- Pear release: `2413`, length `2413`
- PearBrowser catalog:
  `hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f`
- Source:
  `https://github.com/iesetorg/matchday-mesh`
- Primary track: Pears Stack
- Honest secondary scope: WDK demo-ledger only; QVAC gated until local SDK
  inference is proven.

## Pre-Recording Gate

Run these from the repo root before recording:

```sh
npm ci
npm run check:final
```

`npm run check:final` ends by running `npm run handoff:submission`. Run
`npm run handoff:submission` by itself whenever you only need the page fields,
video beats, and proof highlights.

Expected handoff highlights:

- released app prints release `2413`, length `2413`;
- preview smoke reports 6 operations, latest `feed:pool-contribution`, 5 USDt;
- demo proof reports 8 operations;
- live pairing reports read-only replica with 4 operations;
- catalog proof reports the live PearBrowser catalog and visual proof card.

## DoraHacks Page

Paste the page fields from `docs/DORAHACKS_PROJECT_COPY.md`.

Use these short decisions while filling the page:

- Track: Pears Stack.
- License: MIT.
- Repo: `https://github.com/iesetorg/matchday-mesh`.
- App link: the released `pear://` link above.
- Catalog link: the `hyperbee://` catalog above.
- Prior work disclosure: link or paste the summary from `PRIOR_WORK.md`.
- Video: unlisted YouTube link after recording.

Do not claim WDK or QVAC track eligibility unless the real SDK paths are added
and locally verified. The current USDt pool is a WDK-shaped deterministic demo
module, and QVAC is intentionally gated.

## Three-Minute Demo Recording

Target length: 2:45 to 3:00.

1. 0:00 - Open with the Pear app link and PearBrowser catalog key. Show
   `Matchday Mesh`, Pears primary status, WDK demo status, and QVAC gated.
2. 0:20 - Show `Final Night Fan Zone`; claim or select Ada's fan pass.
3. 0:40 - Click `Scan Pass`; show the door state becoming `Accepted`.
4. 0:55 - Post a prediction and a match note into the watch-party feed.
5. 1:15 - Open `Host snacks pool`; add Ada's 5 USDt demo contribution and show
   the newest `pool-contribution` feed card.
6. 1:40 - Export the P2P invite, show `matchday-mesh-core-invite-v1`, host the
   pairing topic, and mention the live Hyperswarm proof covers read-only replica
   join and catch-up.
7. 2:10 - Click `Proof`, `Export Log`, and `Import Log`; explain that testers
   can round-trip the operation log without a cloud backend.
8. 2:35 - Close on the public repo, `docs/proof/`,
   `npm run check:final`, and `npm run handoff:submission`.

Keep the narration honest:

- "Primary track is Pears Stack."
- "The USDt pool is a deterministic WDK-shaped demo path."
- "QVAC remains gated until local QVAC SDK inference is proven."
- "Autobase multiwriter is not claimed; read-only Corestore replication and
  hosted Hyperswarm pairing are proven."

## Evidence To Attach Or Mention

- `docs/proof/pear-release-renderer-proof-2026-06-30.json`
- `docs/proof/pear-release-window-2026-06-30.png`
- `docs/proof/matchday-preview-smoke-2026-06-30.json`
- `docs/proof/matchday-demo-flow-proof-2026-06-30.json`
- `docs/proof/matchday-live-pairing-2026-06-30.json`
- `docs/proof/matchday-live-readiness-2026-06-30.json`
- `docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.png`
- `docs/proof/dorahacks-readiness-2026-06-30.json`

## After Upload

1. Add the unlisted YouTube link to the DoraHacks project page.
2. Confirm the GitHub repo is public and still MIT licensed.
3. Confirm the Pear app link opens with `pear run`.
4. Confirm the catalog key is included in the submission text.
5. Run `npm run check:final` one final time and keep the manual action
   list visible while checking the page.
