# Sourced once by each public Cowork tool. Helpers inherit the marker, preventing double counts.
if [ "${RONIN_TOOL_COUNTED:-}" != 1 ]; then
  export RONIN_TOOL_COUNTED=1
  export RONIN_TOOL_INVOKED="${RONIN_TOOL_INVOKED:-${BASH_SOURCE[1]}}"
  _count_root=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
  _count_dir=$("$_count_root/bin/ronin-store" telemetry 2>/dev/null)
  if [ -f "$_count_dir/tool-count-hook" ]; then
    _count_hook=$(cat "$_count_dir/tool-count-hook" 2>/dev/null)
    python3 "$_count_hook" add "$_count_dir/tool-counters" "$@" >/dev/null 2>&1 || true
  fi
  unset _count_root _count_dir _count_hook
fi
