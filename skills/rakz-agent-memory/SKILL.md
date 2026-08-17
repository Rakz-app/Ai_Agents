---
name: rakz-agent-memory
description: The agent's persistent memory about the user, stored locally as MNS files - how they memorize, their personal anchors, distilled journal notes. Load its core at the start of any Rakz session, query it by keyword mid-session, update it with evidence after. Use when recalling or recording anything about the user.
---

# Rakz agent memory

The agent remembers the user **in the format it teaches**: memory entries are
MNS blocks — mnemonics about the user. All local, plain text, user-owned;
the user can open, edit, or delete any of it in any editor.
Format rules live in `rakz-mns-format`.

## Layout

```
~/.rakz/memory/
├── style.mns     ← how they memorize: styles with evidence tallies, library path
├── persona.mns   ← who they are: people, interests, situations, tone (consent-gated)
└── journal.mns   ← distilled notes from day-to-day things they share
```

On first session, create missing files containing just the magic line
`%RAKZ 0.1`, and tell the user where their memory lives.

## Block conventions

```
mn===
@title:
Abood memorizes best with short absurd imagery
!@
@tags:
-style
!@
@keyword:
-أسلوب
-صور
!@
@importance:
4
!@
@id:
style-imagery
!@
@context:
Evidence: 4 sessions, last 2026-08-17. Corrections push toward:
shorter, funnier, in dialect.
!@
===end
```

⚠ Lists (`@tags:`, `@keyword:`) are **dash-only** — one `-item` per line,
never commas or same-line values (see `rakz-mns-format`).

| Prefix | Role in memory |
|---|---|
| `@:` | The remembered fact — one line |
| `@c:` | Detail + evidence + last-seen date |
| `@k:` | **Retrieval triggers** — when these words/topics come up, pull this block |
| `@t:` | `style` / `persona` / `journal` + free tags |
| `@imp:` | Loading priority: 4–5 = core (always loaded), 3 and below = on demand |
| `@s:` | `active` / `inactive` = archived, never deleted |

## Loading discipline — the token rules

1. **Session start:** load the core only — blocks with `@imp:` ≥ 4.
2. **Mid-session:** when a topic surfaces, query by `@k:` keyword and pull
   only the matching blocks.
3. **Full read of all memory:** only when the user explicitly asks
   (e.g. "what do you know about me?" / a memory audit).

## Tools — decision table

Prefer the `mns` tool — a command costs almost nothing in tokens because only
the filtered result enters context. It ships with the agent at
`~/.rakz/agent/tools/mns/mns.mjs`; run it as `mns …` if the launcher is on
PATH, else `node ~/.rakz/agent/tools/mns/mns.mjs …`. Reading files directly
is always a legal fallback (tolerant reader, `rakz-mns-format`).

| You want | First choice (tool) | Fallback (no tool) |
|---|---|---|
| Orient: what memory exists | `mns list ~/.rakz/memory/` | scan files for `@:` title lines only |
| Recall on a topic | `mns query ~/.rakz/memory -k <kw> --limit 5` | read the one relevant file |
| Load the session core | `mns query ~/.rakz/memory --imp-min 4` | read `style.mns` only |
| Save a new memory | `mns append <file>` (block on stdin, always with an `@id:`) | append a block at end of file — touch nothing above it |
| Update a field / add evidence | `mns set <file> --id <x> --imp 5` / `--add-context "…"` | append a superseding block; never hand-edit existing lines |
| Archive a stale block | `mns set <file> --id <x> --status inactive` | same as above |
| Rework a block's text | `mns set <file> --id <x> --set-context "…" --keep-old` | same as above |

**Unsure which tool or file?** Run the cheapest orientation step first
(`mns list`, or titles-only scan), then decide. Never read everything as a
way of deciding.

## Writing rules

- **All writes go through the tool.** Never edit `.mns` text by hand while
  the `mns` tool works — `set` does parse → edit the object → serialize, so
  conformance and the no-deletion principle are enforced by code, not by
  your discipline. The only exception is the no-Node fallback: append at the
  end of the file, and touch nothing above.
- **Every memory block gets an `@id:`** at creation — a short kebab-case
  slug (e.g. `style-imagery`). It is the address every later `mns set`
  targets; a block without an id can only be updated by guesswork.
- **Evidence discipline:** record only real outcomes (loop corrections, recall
  results) or things the user explicitly said — dated. Never impressions.
- **Consent:** before recording anything personal (people, feelings,
  situations, journal entries), ask first — once per kind of thing. If the
  user says "record freely", store that permission itself in `persona.mns`.
- **Update in place:** refine the existing block instead of adding a
  near-duplicate; merge overlaps during natural pauses.
- **Archive, don't delete:** retire stale blocks with `@s: inactive`.
  Deleting is the user's right, by hand, in their own files.
- **The user's word wins:** if they edit or contradict memory, update it —
  don't argue.

## Applying memory

Bias mnemonic candidates toward high-evidence styles — and mine `persona.mns`
and `journal.mns` for hooks: a mnemonic anchored in the user's own people,
days, and jokes sticks far better than a generic image. About 1 in 5 items,
try an untested style — memory should explore, not fossilize.
