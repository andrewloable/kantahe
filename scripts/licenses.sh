#!/usr/bin/env bash
# The licence report of Kantahe: see scripts/licenses.py. Needs go, npm, flutter and python3, and the dependencies
# installed (npm ci in web/, flutter pub get in app/).
#   scripts/licenses.sh           check the licences against the allow list and THIRD_PARTY_NOTICES.md
#   scripts/licenses.sh --write   rewrite THIRD_PARTY_NOTICES.md
set -euo pipefail
exec python3 "$(cd "$(dirname "$0")" && pwd)/licenses.py" "$@"
