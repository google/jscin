#!/bin/sh
# Pre-commit check (call from .git/hooks/pre-commit)

set -e
trap error EXIT

error() {
  echo "FAILED. ABORT."
  exit 1
}

src="$(dirname "$(readlink -f "$0")")"
echo "Check in: $src"

cd "$src"
echo "Running eslint"
npx eslint
echo "eslint is OK."

echo "Starting gen_inp_test"
cd tests
node gen_inp_test.js | grep -v '^table='

trap - EXIT
echo "SUCCESS!"
