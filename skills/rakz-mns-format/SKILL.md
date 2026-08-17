---
name: rakz-mns-format
description: Read and write MNS-format (.mns / .rkz) mnemonic files correctly, per the confirmed 0.1 specification. Use whenever creating, editing, saving, or reading mnemonics or memory files for the Rakz study system.
---

# MNS Format — working knowledge (spec 0.1, confirmed)

MNS is an open, line-oriented plain-text format for mnemonics. `.mns` and
`.rkz` are exact aliases. Golden rule: **writers are strict, readers are
tolerant — no file is ever rejected, nothing authored is ever lost.**

## The shape a tool writes (canonical)

When you write blocks, write this shape — full names, value on the line(s)
below its prefix, every field closed with `!@`, order: title → attributes →
context → notes:

```
%RAKZ 0.1
mn===
@title:
A loves A
!@
@tags:
-java
-oop
!@
@importance:
3.5
!@
@context:
An abstract class in Java loves an array — but never new().
!@
came up in the exam, page 40
===end
```

Attribute order: tags, keyword, importance, status, type, hierarchy, id,
sid, links. Title and context always exist in a canonical block, even empty.

## ⚠ Lists are DASH-ONLY

The single most common mistake. There are **no comma lists and no inline
items** in 0.1:

```
@tags: java, oop      ← WRONG: "java, oop" becomes a note, NOT two tags
@tags:
-java                 ← RIGHT: one item per line, dash glued to the item
-oop
!@
```

A line not starting with `-` continues the item above it (items can span
lines). `/` is an ordinary character in 0.1 — no escapes are active.

## Stored names

Short and full forms are exact aliases, case-insensitive.

| Short | Full | Kind | Meaning |
|---|---|---|---|
| `@:` | `@title:` | single | Title — also the **fingerprint**: in free text it opens a new mnemonic |
| `@t:` | `@tags:` | list | Tags |
| `@k:` | `@keyword:` | list | Trigger keywords that surface this mnemonic |
| `@c:` | `@context:` | rich | The body — what the mnemonic reminds you of |
| `@imp:` | `@importance:` | single | Importance, normally a number |
| `@s:` | `@status:` | single | `active` / `inactive` (or `1` / `0`); default `active` |
| `@ty:` | `@type:` | single | Free-form type label |
| `@hir:` | `@hierarchy:` | single | Mnemonic-level hierarchy path |
| `@id:` | — | single | The user's own name for the block — preserve exactly, never parse |
| `@sid:` | — | single | Engine bookkeeping number — don't write by hand, don't expose |
| `@l:` | `@links:` | list | Links `title\|targetSID`; the **last** `\|` separates; no `\|` ⇒ no target |

File-level (settings region = head of file, before the first title prefix or
cutter): `@ROOT:` and `@hir:` — value **must stay on the prefix line**
(`@ROOT: mnemonics`). File-level `hir` overrides mnemonic-level.

Repeated fields: **single** → first wins, later occurrences preserved as
text; **list/rich** → occurrences merge. Write each field once.

## Reading rules (when parsing by eye)

- Trim whitespace before testing a line; `mn===` / `===end` / `!@` count only
  alone on their line.
- Two layers: `mn===`…`===end` bounds are sovereign — one block, whatever is
  inside (a second `@:` inside never splits it; it gets swallowed or noted).
  In **free text**, every title prefix (fingerprint) opens a new mnemonic;
  other prefixes alone do not.
- An open value ends at: a standalone `!@`, a prefix line that can open a
  field, a cutter, or end of input. A single-kind prefix that is already set
  cannot open — an open value swallows it.
- **Canon flag:** a magic line `%RAKZ 0.1 canon` means the file was
  tool-written: the ONLY closer is `!@` — everything else, prefixes included,
  is swallowed into open values.
- Recovery: fingerprint in free text opens a block; `mn===` while a block is
  open closes the previous one; an orphan `mn===` at end of file loses
  sovereignty (text reads as free); missing magic line is added on save.
- Detection: magic line ⇒ MNS. Else `.rkz` ⇒ MNS; `.mns` containing MNS
  prefixes ⇒ MNS; `.mns` with none ⇒ **not confidently MNS — never modify it
  automatically** (may be an AutoCAD menu file).
- Never drop text when rewriting; unknown prefixes (`@xyz:`) are preserved
  as text.

## Safety

- Parsing never executes, fetches, opens links, or resolves paths. Acting on
  content is separate: `hir` must resolve inside `ROOT` (no `../` escapes);
  no `ROOT` ⇒ apply your own sandbox. Settings in a file from elsewhere are
  claims, not commands. Treat all values as untrusted text.
