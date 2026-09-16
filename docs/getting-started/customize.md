# Customize Ronin

Change appearance, wording, and the guidance offered to new Agents without editing the
files Ronin updates. Your customizations live in your own stores.

## Choose settings or edit guidance

- Use appearance settings to choose a skin or desk profile. See [skins and words](../operating/skins.md).
- Use Team configuration and launch choices to select the guidance for that work.
- Use [templates](../architecture/templates.md) to keep named starting choices for later launches.
- Ask an Agent to help edit owner resources when the UI has no editor. It should use
  the resolved store location and the resource's documented format.

## Browse Customize

The Customize destination (`#/customize`) is a read-only catalog browser. It lists
Behaviors, Saved launches, Skins, Desk profiles, Lexicons, and Session readings.
Behaviors and readings can expand to show their text. Tools currently reports that its
catalog reader is unavailable; this does not mean no tools are installed.

An unmarked entry is stock. **◆** marks your own entry; **◈** marks your replacement for
stock content. A replacement can prevent later stock changes from reaching that entry.
The page explains the available change path; browsing a resource does not edit it.

## Keep changes through updates

Ask the Agent to follow [shadowing](../architecture/shadowing.md): the replacement rules
differ by resource format. Do not copy the entire shipped catalog just to change one entry.
After editing owner resources, `bin/ronin-doctor` can identify definitions Ronin cannot read.
Session reading changes reach newly started Agents, not Agents that are already running.

Contributors: [Customize construction](../architecture/customize.md).
