#!/usr/bin/env bash
# Fails unless the person who started the run is an admin of launchdarkly-labs/cloudfront-reverse-proxy.
# Forks skip the check: there, whoever can start a workflow (write access) can run it.
#
# Needs GH_TOKEN, GITHUB_REPOSITORY and ACTOR (github.triggering_actor, so a re-run is checked against
# whoever re-ran it, not whoever started the first attempt).
set -euo pipefail

upstream="launchdarkly-labs/cloudfront-reverse-proxy"

if [ "$GITHUB_REPOSITORY" != "$upstream" ]; then
  echo "Running in ${GITHUB_REPOSITORY}, not ${upstream}: no admin check."
  exit 0
fi

permission=$(gh api "repos/${GITHUB_REPOSITORY}/collaborators/${ACTOR}/permission" --jq .permission)
if [ "$permission" != "admin" ]; then
  echo "::error::Only admins of ${upstream} can run this workflow. ${ACTOR} has ${permission} access."
  exit 1
fi
echo "${ACTOR} is an admin of ${upstream}."
