# Local Tryout

Use this when you want to test Matchday Mesh as a local browser app before
opening the released Pear link.

## Start

```sh
npm ci
npm run check:final
npm run try:preview
```

Open:

```text
http://127.0.0.1:4173/
```

Stop the preview with `Ctrl+C` when you are done.

## Click Path

1. Confirm the first screen shows `Matchday Mesh`, `Final Night Fan Zone`,
   `Pears preview`, `WDK demo`, and `QVAC gated`.
2. Click `Scan Pass`; Ada should move to `Accepted`.
3. Click `Open Pool`, then click `Add`; the pool should show
   `5.00 USDt / 50` and the newest feed card should be
   `Ada contributed 5 USDt`.
4. Click `Export Log`; the tester panel should show an operation log with
   6 operations.
5. Click `Import Log`, paste the exported log, then click `Apply Import`; the
   tester panel should show `Import Applied` and `imported 6 ops`.

## Proof Commands

```sh
npm run verify:preview-smoke
npm run verify:submission
```

For a from-zero public repository rehearsal:

```sh
npm run verify:public-checkout
```

For the released Pear app:

```sh
pear run pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy
```
