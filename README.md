# Rakz Agent

> An AI study companion built on mnemonics and feedback loops — it proposes
> memory hooks, you correct, it refines until it converges on *your* style,
> and it keeps learning you across sessions.
> Part of the [Rakz](../) project. Works with any AI harness that supports the
> open Agent Skills format (`SKILL.md`); ships with a first-class Claude Code path.

**وكيل استذكار بالذكاء الاصطناعي مبني على المينوميكس** — بيدرّبك تصنع خطاطيفك
الذاكرية بنفسك، بيلفّ عليها معك بلوبات استرجاع، وبيتعلم أسلوبك مع الوقت.
التثبيت: يدوي خطوة بخطوة، أو بنقرة زر — بتلصق برومبت واحد لأداة الـ AI تبعتك
وهي بتثبّته عنك. شوف [INSTALL.ar.md](INSTALL.ar.md).

## What's inside

| Path | What it is |
|---|---|
| `skills/rakz-mns-format/` | Read & write MNS-format (`.mns` / `.rkz`) mnemonic files correctly |
| `skills/rakz-study-loop/` | The core feedback loop: propose → user corrects → refine → converge |
| `skills/rakz-library-loop/` | Autonomous sweep over the `.mns` library — opt-in only, token-bounded |
| `skills/rakz-agent-memory/` | The agent's memory of the user — stored as MNS blocks, local, consent-gated |
| `agents/rakz-tutor.md` | Optional agent definition for harnesses that support custom agents |
| `tools/mns/` | Internal `mns` CLI (list / query / append / set) — the agent's only write path to `.mns` files |
| `INSTALL.md` / `INSTALL.ar.md` | The install tutorial — manual path & one-prompt AI path |

## Install

- **One-click (AI-assisted):** paste the install prompt from [INSTALL.md](INSTALL.md)
  into your AI coding agent. It detects your harness, places the skills, verifies,
  and greets you ready to study.
- **Manual:** follow the step-by-step path in the same file.

All user data (style profile, mnemonic files) stays **local, on your machine**.

## Design in one paragraph

The agent itself is text, not code: portable skill files any capable model can
load. Its core is a feedback loop — it proposes a mnemonic, you correct it, it
refines from your exact feedback, and every correction becomes recorded style
signal, so each session starts smarter than the last. Its memory of you is
itself a set of MNS files on your own disk — mnemonics about you, readable
and editable in any text editor, never sent anywhere. A second, autonomous
loop can sweep your existing library to flag and fix weak mnemonics — but only
when you explicitly ask, within stated token bounds. A light recall check
keeps sessions honest without turning the agent into a quiz machine.
Everything it saves is plain MNS text you can open in any editor.

## License

Instructions and docs: same spirit as the Rakz project — see the
[MNS spec](../parser/parser/mns-parser/SPEC.md) (confirmed 0.1) for format
licensing. `tools/mns/vendor/` is MIT-licensed mns-parser build output.
