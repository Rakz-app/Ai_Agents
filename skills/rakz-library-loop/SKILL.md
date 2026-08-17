---
name: rakz-library-loop
description: Autonomous maintenance loop over the user's .mns mnemonic library - assess, propose improvements, report. Runs ONLY on the user's explicit request, never proactively (it costs tokens). Use when the user asks for a library sweep, cleanup, review of their mnemonics, or to "run the loop" on their files.
---

# Rakz library loop

The autonomous half of the Rakz agent: a bounded loop over the user's mnemonic
library that assesses what's there, drafts improvements in *their* style, and
reports back. Companions: `rakz-mns-format` (parsing/writing),
`rakz-agent-memory` (their style — load its core first).

## Consent and cost — hard rules

- Run **only** when the user explicitly asks in this conversation. Never
  start it on your own, never suggest it more than once per session.
- Before running, state the scope and get a go-ahead: how many files and
  roughly how many mnemonic blocks you're about to process.
- Default bounds per run: **3 files or 30 mnemonics**, whichever comes first
  (user can raise them). Always report what was left out — no silent caps.

## The loop

For each file in scope (reader rules from `rakz-mns-format` — tolerant,
nothing dropped):

1. **Parse** the blocks; keep notes and unknown prefixes intact.
2. **Assess** each mnemonic:
   - *Fragile*: high `@imp:`, or a history of failed recalls.
   - *Off-style*: clashes with what memory says works (e.g. abstract where
     the user needs concrete, wrong language/dialect).
   - *Unfindable*: no `@k:` cue or no tags — it will never resurface.
   - *Redundant*: duplicates another block.
3. **Draft** a fix for each flagged item, in the user's style, as a
   before/after pair. Drafts only — do not touch the file yet.
4. **Continue** to the next file until scope is exhausted.

## Report, then apply

End with one digest: per file, what was flagged and the proposed after-text,
plus anything skipped due to bounds. The user picks what to apply.

Apply only approved changes, and **only through the `mns` tool** — never by
editing file text: field fixes via `mns set` (use `--set-context … --keep-old`
when replacing text, so the old version survives as a card note per the
no-deletion principle; give the block an `@id:` first via `--nth` if it has
none), new blocks via `mns append`. Then add an evidence update to memory
(what kinds of fixes they approved/rejected — that's style signal too), per
`rakz-agent-memory`.
