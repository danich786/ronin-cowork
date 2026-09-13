# How Cowork resolves an Agent's instructions

Ronin should settle what is installed and enabled for the system before it asks how a
particular Cowork Agent should behave. That order keeps system facts out of Team and Agent
pickers and leaves only meaningful choices there.

This is the intended instruction model. The existing Routine manifest and
Campaign-to-Team resolver described under [Current implementation](#current-implementation)
still deliver births today; this page does not claim that the new settings or migration
already exist.

## Installation first, Agent configuration second

```text
Installations
    ↓ resolve what is installed and on for this system
System shape
    ├── resolved Cowork core
    └── features made available by installed providers
              ↓
Cowork Agent configuration
    ├── Team defaults → Agent overrides for available features
    └── Team defaults → Agent overrides for behaviours
              ↓
Launch context adds automatic conditional instructions
              ↓
one resolved Agent birth
```

An **installation** is a system-level switch. Campaign settings is where the owner turns
an installed component on or off, but that location does not make the switch a Team or
Agent preference. Installation is resolved first because it determines what kind of
Cowork system exists for everything below it.

An installation can have either of two effects:

| Installation effect | What it means downstream |
|---|---|
| System contribution | Its functionality and instructions become part of the resolved Cowork core. There is no duplicate Team or Agent switch. Cowork itself, Ronin Base, and system-wide Ronin Services belong here when installed and on. |
| Feature provider | It makes one or more features available for Team defaults and Agent overrides. gbrain, a Trello connection, or a Perplexity research service can work this way. Installation makes the choice possible; it does not necessarily enable the feature for every Team. |

One installation may eventually do both, but each downstream effect should be stated
plainly. Turning an installation off removes its contribution or availability on the next
birth. It does not rewrite an Agent that is already running.

## What reaches a Cowork Agent

The **resolved Cowork core** is the base Cowork birth plus contributions from enabled
system installations. Choosing a Cowork Agent selects that assembled core; the owner does
not then choose Ronin Base again in the Agent form. A bare-metal Agent remains the explicit
escape hatch: it bypasses Cowork instruction assembly rather than representing a Cowork
Agent with every option off.

**Conditional instructions** follow facts that have already been chosen elsewhere. A Team
lead receives Team-lead instructions because it is the lead. A managed repository receives
the Worktrees contract because of its repository arrangement; a direct checkout receives
the corresponding checkout guidance. These are automatic consequences, not features in a
picker and not preferences an owner must understand to launch an Agent.

After installation resolution, two genuinely configurable kinds remain:

| Kind | Question it answers | Resolution |
|---|---|---|
| Feature | What extra facility or taught practice should this Agent have? | The Team answer is the default for its Agents; an Agent may override it. A feature may depend on an installed provider or may be prompt-only. |
| Behaviour | How should the Agent conduct otherwise ordinary work? | The Team answer is the default; an Agent may override it. Behaviours should express useful preferences such as writing decisions down or asking for more checkpoints, not job descriptions or skills the model already has. |

The practical resolution order is therefore:

1. resolve system installations and whether each is on;
2. assemble the Cowork core and the set of available features;
3. apply Team defaults and Agent overrides for features and behaviours;
4. derive conditional instructions from the Agent's actual role, repository, and setting;
5. compile the result into one birth packet with provenance.

Each fact has one owner. A system installation is not repeated as an Agent feature; a
repository contract is not disguised as a behaviour; becoming Team lead is not a selectable
coordination persona. The planned simplification also retires session-role descriptions
such as “cut code” or “riff on it” as a configuration category. The objective says what the
Agent is doing; optional behaviours say only how the owner wants it done.

## Current implementation

A **Routine** is currently a named, switchable bundle of behaviours that work together:
startup reading, discoverable SOPs, macros, actions, command-line tools and MCP connections.
A Routine changes what a newly launched Agent is offered. Changing a switch never mutates
an Agent already running.

### Four ways to work

| Choice | Meaning | How it is chosen |
|---|---|---|
| Bare-metal Agent | A provider CLI in an always-on tmux terminal, with no Ronin reading, Library material, work record or Routines. | Choose the bare-metal launch. |
| Cowork floor | The minimum Cowork launch, identity and Routine-delivery machinery. | Choose a Cowork Agent rather than bare metal. |
| Ronin Base | Ronin's ordinary macros, documents, work records, messaging and session coordination. | Selectable Routine. |
| Ronin Worktrees | Separate worktrees, hand-in, lead integration, receipts and Git safeguards. | Selectable Routine. |

The **Cowork floor** is not a Routine. It is the minimum needed to make any Routine
choice real: unified Agent launch, Campaign and Team resolution, the universal vocabulary
and shelf map, Routine resolution, minimum command delivery, Control initialization and
the birth receipt. Ordinary working behaviours such as fork, tell and wipeboard belong to
Ronin Base rather than being made permanently available through the floor.

The floor is mandatory only for a **Cowork Agent**. Ronin offers three distinct launch
kinds:

| Kind | What starts | Ronin birth |
|---|---|---|
| Terminal | A shell, with no Agent CLI. | None |
| Bare-metal Agent | The selected CLI directly in the tmux session. | None |
| Cowork Agent | The selected CLI through the unified Agent birth transaction. | Routine floor, then resolved Routines |

A bare-metal Agent has a session name, working directory and inherited environment. It
does not receive Campaign or Team resolution, project root or role, a Ronin brief or shelf
reading, Routine resolution, Ronin-added MCP, a work record, a managed desk, or a managed-
birth receipt. Host-level tmux safety and the session maximum still apply because they
govern the machine rather than equip the Agent.

Bare metal is not “all Routines off.” A Cowork Agent with every switch off still receives
the Routine floor. Bare metal explicitly bypasses the Cowork birth transaction.

**Ronin Base** and **Ronin Worktrees** are separate switches, but delivery is
additive: selecting Ronin Worktrees also selects Ronin Base. A Team can use
Ronin Base without acquiring repository worktrees. Control does not require optional
Ronin Services. Repository arrangement states where managed worktree behaviour applies;
it is not another Routine switch.

**Specialized Routines** remain separately selected optional packages for one capability
or methodology: gbrain, Ronin Services, or a future third-party method. They add to Ronin
Base rather than creating partial replacements for it, and every one of them requires Base —
the dependency always points that way, and nothing is ever required BY Base.

**Ronin Host** is the Routine about the box Ronin is installed on, as opposed to what Ronin
itself provides. That is the line against Ronin Services: Services is Ronin's own optional
machinery — the durable session record, Koshi, Voice, Hotwords — while Host is the machine
underneath, which would exist whether or not Ronin were on it. It is an ordinary selectable
Routine: it requires Ronin Base like its siblings, and it is popped on and off in the
picker.

| SOP | The question it answers |
|---|---|
| `accounts` | Who this install is for, and what it runs on. |
| `install` | Is this install actually what it claims to be. |
| `remote_machine_admin` | Keeping the machine's groundwork in order. |
| `remote_machine_health` | The box is slow, or something died. |
| `tmux_server` | The session engine, and how this house keeps it healthy. |
| `vpn` | Reaching your own Ronin from your other devices. |

with `tejun-survey`, `tejun-account` and `tejun-secrets` to measure rather than assert, and
`HOST_ABILITIES.md` as birth reading. Testing Ronin itself remains repository-contributor
instruction and is not part of a user's Routine.

Its SOPs report and diagnose; none of them repairs the box unasked. The session engine in
particular is never a session's to restart: it owns every session on the machine, so the
repair would end the Agent performing it.

**The one restart an Agent may perform is Ronin's own, and it belongs here** —
`tejun-machine-restart`, no argument and no unit to name. An Agent without the host tools
has no business restarting anything, so the capability sits with the rest of the box
material rather than in Base. Nothing is lost by that: the guard shims are `routine_floor`
and reach every Agent regardless of Routine, so a session without Host that reaches for
`systemctl` is refused rather than left to improvise. That refusal is what was missing when
this house lost every live session twice in one day.

**Ronin Services** is one specialized Routine containing the durable session record,
Koshi, Voice and Hotwords. None is a standalone Routine or switch in this rollout.
Hotwords have no independent use when Voice is unavailable. Installing Services or seeing
one of its registered services proves availability only; it never selects the Routine.
Selecting Ronin Services additively includes Ronin Base.

### Campaign defaults and Team answers

The effective set for a birth is resolved in one direction:

```text
Campaign Routine defaults
            ↓
New Team form receives those values
            ↓ Save
Team's complete on/off map
            ↓
effective Routines for this Agent birth
```

A Team stores a complete map at Save. Its births read that map and never follow later
Campaign edits. An absent key in the selected complete map is off; an enabled Routine's
declared dependency may still add it as part of the additive progression. A Teamless
Agent receives the Campaign answer at birth.

The resolver keeps provenance, so a surface and birth receipt can say whether the answer
came from the Campaign or Team. It resolves once before the Agent process exists; the
same result feeds every delivery mechanism.

### One birth, several deliveries

For each enabled Routine, the unified birth transaction projects the manifest into the
places where its behaviours actually work:

- the manifest's declared startup reading is compiled into the Agent's one birth README — `reading:` when the Routine is on, `reading_off:` when it is off, so the Agent knows what the owner is working without and where the switch is;
- its macros and actions are offered and compile;
- its command tools are findable by bare name;
- its requested MCP connections are included when available;
- the receipt records what was enabled, why, and what was delivered.

The session boot shelf remains the reading mechanism, not the owner of Routine selection.
`<service>_connected/` remains the compatibility level for service-authored reading tied
to a connection; it is only one case and is not the general Routine switch. The first
cut explicitly retains the `gbrain_connected` level: gbrain's service authors and seeds that
connection reading, while the `gbrain` Routine selects its macros, tools and MCP request.

### Four different facts

| Fact | Answers |
|---|---|
| enabled | Did the resolved Campaign → Team → Agent cascade select the Routine? |
| installed | Are its local/service parts present on this machine? |
| connected | Was an MCP or other live connection delivered? |
| applicable | Does the present repository/situation use this behaviour? |

**And a fifth, which is not a Routine fact at all: whether the Agent holds a worktree.**
*Carrying `ronin_worktrees` does not mean a worktree was mounted for you.* The Routine is a
reading list and a toolset — the desk contract, hand-in, team promotion, receipts and
`tejun-desk` — so that every Agent carrying it knows how worktrees are handled here. An
Agent under Ronin Worktrees may hold none, and check one out when it needs one. An Agent
without the Routine may still be started in a worktree: that is isolation, which any agent
can arrange off a branch, and it needs nothing declared in `RONIN_REPO`. What it does not
get is the contract — no hand-in, nobody to hand to — so it reports to the owner instead.
All four combinations are legitimate. Campaign supplies the default Routine map, a saved
Team replaces that complete map, and an Agent may override individual answers for its own
birth without changing either parent. The resulting **Agent capability** is combined with
the selected Project Root's independent **repository permission**. There is no second
launch-time desk switch.

These facts never stand in for one another. In particular, an enabled but unavailable
Routine **never blocks Agent birth**. The Agent opens normally; the unavailable behaviour
does not work, and the receipt and surfaces say it was not delivered.

### Catalog authority

Routine manifests live in `ronin_catalogs/routines/`, one Markdown definition per token.
The owner's catalog store shadows a stock definition whole. A manifest names existing
reading, SOPs, macros, actions, tools and MCP connections; Campaign and Team records hold
on/off maps, while a launch may hold sparse Agent overrides. Nothing about Routine
membership is copied into those records.

The manifest is enablement rather than a security boundary. Off means Ronin does not
teach, offer or place a tool in the Agent's normal command lookup. It does not claim that
a determined process cannot reach an installed executable by an absolute path.
