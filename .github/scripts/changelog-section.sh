#!/usr/bin/env bash
# Prints the body of one version's section from CHANGELOG.md (Keep a Changelog format) and fails if the
# section is missing or empty.
#
#   .github/scripts/changelog-section.sh 1.2.0 [CHANGELOG.md]
set -euo pipefail

version="${1:?usage: changelog-section.sh <version> [changelog]}"
changelog="${2:-CHANGELOG.md}"

# The section runs from "## [<version>]" to the next "## " heading or the link definitions at the end.
body="$(awk -v v="$version" '
  index($0, "## [" v "]") == 1 { found = 1; next }
  found && (/^## / || /^---$/ || /^\[[^]]+\]: /) { exit }
  found { print }
' "$changelog" | sed -e '/./,$!d' | sed -e ':a' -e '/^\n*$/{$d;N;ba' -e '}')"

if [ -z "$body" ]; then
  echo "error: $changelog has no \"## [$version]\" section with content." >&2
  echo "Move the [Unreleased] entries under \"## [$version] - $(date +%Y-%m-%d)\" before tagging." >&2
  exit 1
fi

printf '%s\n' "$body"
