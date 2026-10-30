#!/bin/zsh
# Build the docs and publish them. The web server serves /docs/* from
# $DEPLOY_ROOT/xiaoxiong-docs, a symlink to the newest release.
# Where to is set in scripts/deploy.env (not in git):
#   DEPLOY_HOST=my-server   # an ssh host
#   DEPLOY_ROOT=/var/www
# Rollback: ssh $DEPLOY_HOST 'ln -sfn $DEPLOY_ROOT/xiaoxiong-docs-releases/<older> $DEPLOY_ROOT/xiaoxiong-docs'
set -euo pipefail
export PATH=/opt/homebrew/bin:$PATH
cd "${0:A:h}/.."
source scripts/deploy.env
: ${DEPLOY_HOST:?set in scripts/deploy.env} ${DEPLOY_ROOT:?set in scripts/deploy.env}

bun run test
rm -rf dist
bun run build
node scripts/compress.mjs dist

REL=$(date +%Y%m%d-%H%M)-$(git rev-parse --short HEAD 2>/dev/null || echo nocommit)
{ git diff --quiet HEAD -- . && [ -z "$(git ls-files --others --exclude-standard)" ]; } 2>/dev/null || REL=$REL-dirty
ssh "$DEPLOY_HOST" "mkdir -p $DEPLOY_ROOT/xiaoxiong-docs-releases/$REL"
rsync -a dist/ "$DEPLOY_HOST:$DEPLOY_ROOT/xiaoxiong-docs-releases/$REL/"

# Copy hashed assets of the live release that are under a week old into the new one, so pages
# opened before this deploy keep working. Timestamps are kept, so carried files age out instead
# of piling up from release to release. Keep the newest 5 releases.
ssh "$DEPLOY_HOST" REL="$REL" ROOT="$DEPLOY_ROOT" sh -s <<'REMOTE'
set -e
cd "$ROOT/xiaoxiong-docs-releases"
CUR=$(readlink -f "$ROOT/xiaoxiong-docs" 2>/dev/null || true)
if [ -n "$CUR" ] && [ "$CUR" != "$PWD/$REL" ] && [ -d "$CUR/_astro" ]; then
  find "$CUR/_astro" -maxdepth 1 -type f -mtime -7 -exec cp -p --update=none {} "$REL/_astro/" \;
fi
chown -R "$(id -u):$(id -g)" "$REL"
find "$REL" -type d -exec chmod 755 {} +
find "$REL" -type f -exec chmod 644 {} +
ln -sfn "$ROOT/xiaoxiong-docs-releases/$REL" "$ROOT/xiaoxiong-docs"
ls -1 | sort | head -n -5 | xargs -r rm -rf
ls -1
REMOTE
echo "已发布 $REL"
