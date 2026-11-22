#!/bin/sh
# Build the sandbox from a checkout of the live repo.
#   sh _sandbox/build.sh /path/to/draftpunk /path/to/draftpunk-sandbox
# Copies the live app, leaves out CNAME (the draft-punk.com domain), points
# sync.js at the fake Firebase modules, and loads sandbox-seed.js first on
# every page. The live repo itself is not modified.
set -eu
LIVE=$1; OUT=$2
cd "$OUT"
find . -mindepth 1 -maxdepth 1 ! -name .git ! -name .github ! -name _sandbox -exec rm -rf {} +
git -C "$LIVE" archive HEAD | tar -x -C "$OUT"
rm -f CNAME
sed -i "s#https://www.gstatic.com/firebasejs/10.12.0/#./_sandbox/fake-firebase/#g" sync.js
for f in *.html; do
  grep -q '_sandbox/sandbox-seed.js' "$f" || sed -i '0,/<head[^>]*>/s##&\n    <script src="_sandbox/sandbox-seed.js"></script>#' "$f"
done
sed -i "s/const CACHE = 'draftpunk-/const CACHE = 'draftpunk-sandbox-/" sw.js
echo "live commit: $(git -C "$LIVE" rev-parse --short HEAD)" > _sandbox/BUILT_FROM
# No error reports from the sandbox into the live Sentry project
printf '// Sandbox: error monitoring switched off (live site reports to Sentry).\n' > sentry.js
# Installed-app settings point at the site root; the sandbox lives in a subfolder
sed -i 's#"start_url": "/"#"start_url": "./"#; s#"scope": "/"#"scope": "./"#' manifest.json
