#!/usr/bin/env bash

ronin_tool_source=${BASH_SOURCE[1]}
while [ -L "$ronin_tool_source" ]; do
  ronin_tool_link=$(readlink "$ronin_tool_source")
  case $ronin_tool_link in
    /*) ronin_tool_source=$ronin_tool_link ;;
    *) ronin_tool_source=$(dirname "$ronin_tool_source")/$ronin_tool_link ;;
  esac
done
SELF=$ronin_tool_source
unset ronin_tool_source ronin_tool_link

# WHICH SESSION AM I — and it must NEVER guess.
# The authoritative sources are the pane this shell runs in, then the tmux session id.
# Browser grid_* viewers are never the answer, and nothing falls back to the focused tile.
ronin_session_me() {
  local win s sid
  if [ -n "${TMUX_PANE:-}" ]; then
    win=$(tmux display-message -p -t "$TMUX_PANE" '#{window_id}' 2>/dev/null) || win=""
    if [ -n "$win" ]; then
      s=$(tmux list-windows -a -F $'#{session_name}\t#{window_id}' 2>/dev/null \
          | awk -F $'\t' -v w="$win" '$2==w && $1 !~ /^grid_/ {print $1; exit}')
      [ -n "$s" ] && { printf '%s\n' "$s"; return 0; }
    fi
  fi
  if [ -n "${TMUX:-}" ]; then
    sid=${TMUX##*,}
    s=$(tmux list-sessions -F $'#{session_id}\t#{session_name}' 2>/dev/null \
        | awk -F $'\t' -v i="\$$sid" '$1==i && $2 !~ /^grid_/ {print $2; exit}')
    [ -n "$s" ] && { printf '%s\n' "$s"; return 0; }
  fi
  return 1
}
