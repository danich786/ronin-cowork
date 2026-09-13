# MIKA — the house assistant

**Mika is who you ask when the thing you need doing is Ronin's own business.** How does a
dial work, add this repo, start me a session for the flaky render test, call me Glen.

She is **a session**, not a service and not a model call the house makes on your behalf.
She runs on your own session_launch_spec from the provider catalog, in a tile you can watch, with a dial you
can turn. That is the whole of what makes her different from a koshi, and the difference is
mechanical rather than a matter of taste:

| | **koshi** | **mika** |
|---|---|---|
| what it is | one stateless API call | a seated agent in a tile |
| its law | *never authors — it marks* | authoring is the job |
| who pays | the house, metered, needs a key | you, on your own session_launch_spec |
| lives in | `ronin-services` | **cowork** — she works, alone, in the free build |

## Getting to her

| | |
|---|---|
| **ミ Help** in the selector header of every workbench | Mika takes over the selector column: the header reads *Mika, your helpful assistant* with **Close** where Help was, the cards step aside, and only her conversation's text shows — no tile head, composer or greeting. Close puts the cards and the roster's title back. **Drag that header** onto a workspace and she moves there as her ordinary tile while the column becomes a selector again. She is started if she is not up |
| **Mika** card on Ronin Setup | the same session as a normal tile in Workspace 2 — it appears as soon as the first model provider is signed in |
| **＋ include** on the ▣ Roots tab | hands her the include job in the same tile. It is no longer a form |
| `mika "<question>"` in a projected shell | starts her if needed and sends the plain-language question |

of them — the handle — was genuinely the owner's. `dir`, `read`, `match` and `remit` are
facts the machine already holds, and the form asked the owner to go and look them up, on a
phone, with autocapitalize off. The real intent is one bit: *this directory, yes.* Making
the form nicer was the alternative and it was the wrong repair, because the fastest form is
still a form. **The per-root edit form stays** — changing one field of a block that already
exists is a different and much cheaper act.

Mika receives plain-language requests. Her authority comes from her selected tools:
`lookup`, `owner_view`, `show`, constrained `machine-settings`, and separately granted
`session_create`. There is no command vocabulary or hidden instruction catalog.

## The one rule — propose, never write

**She shows the change as what it will become and waits for a yes.** Then the yes goes
through the machinery that already exists: `POST /api/project-roots`, `POST /api/launch`,
`PATCH /api/machine-settings`. No second write path and no new refusal rules — which is also the honest
answer to "an agent wrote to my catalog". It did not. It drafted, and you said yes.

`machine-settings --propose` prints the exact canonical method, path and payload plus a
confirmation token. Only after the owner confirms may Mika repeat that identical command
with `--confirmed`; Workspace Folder exclusion and arbitrary writers are unavailable.

**Never a secret** — no key, no token, no credential is read back or written. **Never a
path spelled by hand** — `ronin-store <id>`, always. An assistant is exactly the actor most
likely to helpfully guess a home directory.

## Which model she runs on

The owner's rule (2026-09-09), and only this. The **default provider** (⚙ → *sessions.default*)
supplies her when it is signed in; inside it she takes the configured level (Light unless
moved under ⚙ *Mika model level*) and cascades **up** — Light → Standard → Frontier — never
across to another provider. When there is no default yet, or it is not signed in — the
first-run Setup page — the **first operational provider in catalog order** supplies her with
the same cascade. Providers are never compared for a better level. `src/mika-runtime.ts`.

## Her mandate

Reach **discuss**, recruit **nobody**, output **ideas** — fixed in her launch body
(`mikaLaunchBody`, `src/routes/launch.ts`). She never plans a task and never proposes agents;
a change she suggests goes through propose-and-confirm and Ronin's own doors.

## Tips and tricks — teaching her as you go

**The file: `ronin_session_boot/house/mika/MIKA_TIPS.md` in the cowork repo.** Add a bullet, commit, delete her, click Help: she reads it.

`ronin_session_boot/house/mika/MIKA_TIPS.md` is the owner's bullet list of nuances: the
things the documents state correctly but that still surprise ("the agent's Docs tab is
empty because the agent never listed its documents"). It is compiled into her README at
her next birth, right after her rules, and it is on her Docs list from birth, so it opens
from her tile. Your own copy on the session-boot shelf (`ronin-store session_boot`, under
`house/mika/`) wins over the shipped file.

## Her birth

She is born in her own private home (`ronin-store mika_home`), not in any project root, with
no feature and no behaviour. Her birth README is the ordinary compiled packet with one difference: in
place of the startup shelf it carries the **Mika source index** — the top of every document
under `docs/`, `ronin_sops/`, `ronin_catalogs/`, `ronin_session_boot/` and `ronin_library/`,
owner shadow winning, each with its `mika-source:` reference (`src/mika-knowledge.ts`, budgeted
to one read). Her PATH is her three commands first, then a plain system PATH — a shell she can
run, and nothing of Ronin's own bin:

| command | does |
|---|---|
| `lookup mika-source:<id>` | prints that source, verified against the index she was born with |
| `owner_view <tab>` | what the owner is looking at in that browser tab — Help reports the tab's view when it opens (`public/js/mika.js`), and her brief names the tab |
| `show <tab> <surface>` | opens a Ronin surface in another visible workspace of that tab |

## She is a singleton

One session named `mika_agent`, in the ordinary team `ronin_helpers` (**Ronin Helpers**),
which her launch creates if it is missing and which deletes like any team. The second request finds the first. Two of her
editing `PROJECT_ROOTS.md` at once is a real bug, and unlike a ladder marker a catalog
write is not recomputed next turn.

Both callers check, and neither can produce a second one anyway: `/api/launch` refuses a
name that already exists.

## She honours the dial

A koshi ignores the dial because it is house machinery in the recorder's category — it
reads panes nobody talks to. **Mika is a session you converse with**, so reaching her is an
ordinary send: `ronin_bin/mika` hands off to `edges send`, and her Control value is shown like any
other session's. At 👤 the request is refused and says so.

A house agent that cannot be silenced by the dial is a house agent that cannot be silenced.

**And it will not type over your draft.** `edges send` puts the request into the durable
message queue; safe delivery waits while real unsubmitted text sits at her prompt. Mika is
the session you are most likely to be mid-sentence in, which makes her the last one that
should ever be written to blind. The owner can see the retained request under Messages.

**The check is ghost-aware, and that half is what makes it usable.** Claude renders a
suggested reply at the prompt — the kind you press Tab to accept — in dim text, and there is
almost always one there. Dim is the CLI talking, not you: read as a draft it would block
every send forever, read as an empty prompt it is exactly right. `capture-pane` without
`-e` strips the colour and loses the distinction entirely, which is how a reader (this one)
mistook a suggestion for a draft.

## The session max — counted, never blocked

**She counts toward the total. The cap never refuses her.** Two rules, and collapsing them
is the mistake: *blocking somebody who is asking for help is rude.* Ten of ten running, and
she is the eleventh.

It exempts the **spawn**, never the **census**: she counts the moment she exists, so the
NEXT session is the one refused. **Nothing is evicted to make room** and no session is ever
chosen to die.

The house-seat profile in `src/house-seats.ts` states her exemption; `src/tmux.ts` applies
it when enforcing the session maximum.

## What she is made of

Six things, and five of them are data:

| | |
|---|---|
| `src/house-seats.ts` | her explicit house-seat posture, opening, exemption, and home |
| `src/mika-runtime.ts` · `src/mika-knowledge.ts` | which model (the rule above) · the source index compiled into her README |
| `ronin_bin/lookup` · `owner_view` · `show` · `machine-settings` · `session_create` | her constrained commands; settings writes require proposal and owner confirmation |
| `ronin_session_boot/house/mika/START_HERE.md` · `MIKA_RULES.md` · `MIKA_TIPS.md` | the Setup walkthrough, her rules, and the owner's tips — three sections of her README |
| `ronin_catalogs/capabilities/machine-settings.md` | her settings authority and confirmation boundary |
| `ronin_catalogs/TOOLS.md` | the launcher and selected tool rows |
| `ronin_bin/mika` | the tool: send to her, or start her and then send |
| `public/js/mika.js` · `mika-ready.js` | the ミ Help panel every workbench shares, her Setup tile pool, and the one readiness controller over `POST /api/mika/ready` |

Plus four one-line edits on the launch path so `cap:` is read, carried and honoured
(`catalog.ts`, `spawn.ts`, `routes/launch.ts`, `tmux.ts`).

**No new endpoint, and no new kind of thing.** She is born through `/api/launch` like every
session, and reached with `edges send`, the tool every agent already uses to reach any
session.

## Not built, deliberately

Listed so nobody re-derives one by accident and so re-adding it is a decision:

- **Machine-wide repo discovery.** It needs a *declined* list to behave — never re-offer
  what was turned down — and that is a new store. Naming the directory is one sentence.
- **A command vocabulary.** Mika takes plain words and relies on her constrained tools;
  named job prefixes would create a second authority surface.
- **A question box on the ミ button.** Making someone phrase the question before Mika has
  said hello is the form problem again, one surface further out.

## Where the reasoning lives

The build-out plan, in the lab repo's wip directory — including everything cut from v1 and
why. `ronin_catalogs/lexicons/professional_en.md` § MIKA for the vocabulary, and R31 for the ruling that separated her
from KOSHI.
