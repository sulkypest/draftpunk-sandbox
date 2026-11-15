# Draft Punk — sandbox

Test copy of [Draft Punk](https://www.draft-punk.com), published at
https://sulkypest.github.io/draftpunk-sandbox/ — **not the live site**.

- No connection to Firebase: `sync.js` is pointed at fake modules in
  `_sandbox/fake-firebase/`, which keep a pretend database in the browser.
- `_sandbox/sandbox-seed.js` fills it with mock users and filler chapters, and
  shows a SANDBOX badge (tap it for **Reset test data**).
- Error monitoring (Sentry) is switched off.
- Rebuilt from the live repo with `sh _sandbox/build.sh <live checkout> <this checkout>`;
  `_sandbox/BUILT_FROM` records the live commit. The live repo is never changed by this.

Workflow: change goes here first → tested on real devices → same change pushed to live.
