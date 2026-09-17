#!/usr/bin/env bash
# Build one uploadable zip per skill into dist/.
# Each zip holds a single top-level folder named after the skill's frontmatter
# `name`, with SKILL.md directly inside it, which is the layout claude.ai
# (Settings > Capabilities > Skills > upload) and `claude --plugin-dir x.zip`
# both accept.
set -euo pipefail
cd "$(dirname "$0")"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
rm -rf dist && mkdir dist
for dir in */; do
  dir=${dir%/}
  [ -f "$dir/SKILL.md" ] || continue
  name=$(sed -n 's/^name:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}/\1/p' "$dir/SKILL.md" | head -1)
  name=${name:-$dir}
  cp -R "$dir" "$stage/$name"
  find "$stage/$name" \( -name .DS_Store -o -name __pycache__ \) -prune -exec rm -rf {} +
  (cd "$stage" && zip -qr -X "$OLDPWD/dist/$name.zip" "$name")
  echo "dist/$name.zip"
done
