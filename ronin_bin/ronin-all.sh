# ronin-all.sh — session_archive --all and session_restore --all (KAN-672), sourced by both.
#   ronin_all <archive-all|restore-all> [--status <file>]
# With --status the call runs detached (setsid) and returns at once; <file> holds
# {"state":"running"} and then the answer with "state":"done", or {"state":"failed","error"}.
# Ronin answers within 600 s or the call is failed.
ronin_all() {
  local route=$1 status=""
  shift
  case "${1-}" in
    --status) status=${2:?--status needs a file}; case "$status" in /*) ;; *) status="$PWD/$status" ;; esac ;;
    '') ;;
    *) echo "usage: $(basename "$SELF") --all [--status <file>]" >&2; return 2 ;;
  esac
  if [ -n "$status" ] && [ -z "${RONIN_ALL_DETACHED:-}" ]; then
    printf '{"state":"running"}\n' >"$status.tmp" && mv "$status.tmp" "$status" || return 2
    RONIN_ALL_DETACHED=1 setsid "$SELF" --all --status "$status" </dev/null >/dev/null 2>&1 &
    echo "started; state in $status"
    return 0
  fi
  . "$TOOL_DIR/ronin-http.sh"
  local out code
  out=$(mktemp)
  if ! ronin_connect; then code=000; echo '{"error":"Ronin is not answering"}' >"$out"
  else
    code=$(curl -sS -m 600 "${RONIN_CURL[@]+"${RONIN_CURL[@]}"}" -o "$out" -w '%{http_code}' \
      -H 'content-type: application/json' -X POST "$url/api/machine/$route" \
      -d "{\"pane\":\"${TMUX_PANE:-}\"}" 2>/dev/null) || { code=000; echo "{\"error\":\"Ronin did not answer at $url within 600 s\"}" >"$out"; }
  fi
  python3 - "$code" "$out" "$status" <<'PY'
import json, os, sys
code, path, status = int(sys.argv[1]), sys.argv[2], sys.argv[3]
try:
    data = json.load(open(path))
except Exception:
    data = {}
ok = code == 200 and data.get("ok")
result = {"state": "done", **data} if ok else {"state": "failed", "error": data.get("error") or f"HTTP {code}"}
result.pop("ok", None)
if status:
    with open(status + ".tmp", "w") as f: json.dump(result, f)
    os.replace(status + ".tmp", status)
if not ok:
    print(f"REFUSED: {result['error']}", file=sys.stderr)
    raise SystemExit(4)
for a in data.get("saved", []): print(f"ARCHIVED {a['name']} as {a['id']} ({a['agent']})")
for a in data.get("not_saved", []): print(f"NOT SAVED {a['name']}: {a['error']}")
for a in data.get("restored", []): print(f"REHYDRATED {a['name']}")
for a in data.get("not_restored", []): print(f"NOT RESTORED {a['name']} ({a['id']}): {a['error']}")
word = "restored" if "restored" in data else "saved"
missed = data.get(f"not_{word}", [])
print(f"{len(data.get(word, []))} {word}, {len(missed)} not {word}")
raise SystemExit(4 if missed else 0)
PY
  local rc=$?
  rm -f "$out"
  return $rc
}
