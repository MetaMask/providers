#!/usr/bin/env bash

set -x
set -e
set -u
set -o pipefail

DEFAULT_BRANCH="origin/$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')"
if ( git diff -U0 "${DEFAULT_BRANCH}" -- package.json | grep '"version":' )
then
  ( git diff --name-only "${DEFAULT_BRANCH}" | grep CHANGELOG.md ) || exit 1
fi
