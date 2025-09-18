#!/usr/bin/env bash

set -euo pipefail

# agarra el primer renglon del mensaje desde el archivo temporal
commit_msg=""
if [[ -n "${1:-}" && -f "$1" ]]; then
  commit_msg="$(head -n 1 "$1" | tr -d '\r\n')"
fi

# fallback usando la variable que deja lefthook
if [[ -z "$commit_msg" && -n "${LEFTHOOK_COMMIT_MSG:-}" ]]; then
  commit_msg="$(printf '%s' "$LEFTHOOK_COMMIT_MSG" | head -n 1 | tr -d '\r\n')"
fi

# ultimo intento directo desde git
if [[ -z "$commit_msg" && -f .git/COMMIT_EDITMSG ]]; then
  commit_msg="$(head -n 1 .git/COMMIT_EDITMSG | tr -d '\r\n')"
fi

# si no hay nada o es solo comentario terminamos
if [[ -z "$commit_msg" ]] || printf '%s' "$commit_msg" | grep -qE '^#'; then
  printf '[warn] mensaje vacio, me salto el chequeo.\n'
  exit 0
fi

printf '[check] revisando commit: "%s"\n' "$commit_msg"

# patron de conventional commits
if ! printf '%s' "$commit_msg" | grep -qE '^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([^)]+\))?: .{1,50}$'; then
  printf '[fail] formato raro, spec: \n'
  printf 'usa: <tipo>(scope opcional): descripcion corta\n'
  printf 'tipos validos: build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test\n'
  printf 'tu mensaje: "%s"\n' "$commit_msg"
  exit 1
fi

# largo maximo 72 chars
if (( ${#commit_msg} > 72 )); then
  printf '[fail] muy largo, deberia ser a 72 chars o menos.\n'
  printf 'largo actual: %d\n' ${#commit_msg}
  printf 'tu mensaje: "%s"\n' "$commit_msg"
  exit 1
fi

# descripcion en modo imperativo
description="$(printf '%s' "$commit_msg" | sed -E 's/^[a-z]+(\([^)]+\))?: //')"
if printf '%s' "$description" | grep -qE '^(added|fixed|updated|changed|removed|created)'; then
  printf '[warn] formato en imperativo: add, fix, update, etc.\n'
  printf 'tu mensaje: "%s"\n' "$commit_msg"
  exit 1
fi

printf '[ok] todo piola con el commit.\n'
