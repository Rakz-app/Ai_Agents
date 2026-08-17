# Installing the Rakz Agent

Two paths to the same result. **Path A** is the one-click way: you hand one
prompt to your AI tool and it installs everything for you. **Path B** is the
same thing done by hand.

Either way, what gets "installed" is four skill folders (plain text), one
optional agent file, one small command-line tool (`mns`, needs Node.js), and
one local memory folder. Nothing runs in the background.

> **Source:** wherever you got this — a cloned repo, a downloaded folder, or
> `<REPO-URL>` once published. Below, `SOURCE/` means this folder.

---

## Path A — one click (AI-assisted)

Copy the entire block below and paste it into your AI coding agent
(Claude Code or any harness that can read/write files). It does the rest.

````text
Install the "Rakz Agent" study companion for me. Source folder: SOURCE/
(replace with the actual path or clone <REPO-URL> to a temp folder first).

Follow these steps exactly and report what you did:

1. DETECT the harness you are running in and where it loads Agent Skills
   (folders containing SKILL.md) from:
   - Claude Code → personal skills: ~/.claude/skills/  and agents: ~/.claude/agents/
   - Another harness supporting the open Agent Skills format → its documented
     skills directory.
   - No skills support at all → use the fallback in step 4.

2. INSTALL SKILLS: copy each folder under SOURCE/skills/ (rakz-mns-format,
   rakz-study-loop, rakz-library-loop, rakz-agent-memory) into the skills
   directory, keeping folder names. If a copy already exists, overwrite it
   with this version.

3. INSTALL AGENT (only if this harness supports custom agents/subagents):
   copy SOURCE/agents/rakz-tutor.md into the agents directory, adapting the
   frontmatter to this harness's agent format if it differs.

4. FALLBACK (only if step 1 found no skills support): copy SOURCE/skills/ to
   ~/.rakz/agent/skills/ and append the "bootstrap block" from SOURCE/INSTALL.md
   (section: Fallback bootstrap block) to the instructions file this harness
   always loads (AGENTS.md or equivalent).

5. TOOLS: copy SOURCE/tools/ to ~/.rakz/agent/tools/. If ~/.local/bin exists
   and is on PATH, create an executable launcher ~/.local/bin/mns containing:
     #!/usr/bin/env sh
     exec node "$HOME/.rakz/agent/tools/mns/mns.mjs" "$@"
   Requires Node.js (>= 18). If Node is missing, skip this step and say so —
   the skills fall back to reading files directly.

6. MEMORY: if ~/.rakz/memory/ does not exist, create it with three files —
   style.mns, persona.mns, journal.mns — each containing only the line:
   %RAKZ 0.1

7. VERIFY: confirm the four skills are now visible to you (list them), read
   rakz-study-loop/SKILL.md once, and run `mns list ~/.rakz/memory/` (or the
   node fallback) to confirm the tool answers.

8. Finally, greet the user IN THEIR OWN LANGUAGE: tell them the Rakz agent is
   installed, where the files went, and offer to start their first study
   session right away.

Rules: touch nothing outside the destinations named above; if any step is
impossible in this environment, say so explicitly instead of improvising.
````

---

## Path B — manual

1. **Skills.** Copy the four folders from `SOURCE/skills/` into your
   harness's skills directory:
   - Claude Code (personal, all projects): `~/.claude/skills/`
   - Claude Code (one project only): `<project>/.claude/skills/`
   - Other harnesses: wherever they document Agent Skills / `SKILL.md` loading.

   Result, e.g.: `~/.claude/skills/rakz-mns-format/SKILL.md` (and the other three).

2. **Agent (optional).** If your harness supports custom agents, copy
   `SOURCE/agents/rakz-tutor.md` into its agents directory
   (Claude Code: `~/.claude/agents/`).

3. **Tool.** Copy `SOURCE/tools/` to `~/.rakz/agent/tools/`. Optionally add a
   launcher so `mns` works anywhere — an executable `~/.local/bin/mns` with:

   ```sh
   #!/usr/bin/env sh
   exec node "$HOME/.rakz/agent/tools/mns/mns.mjs" "$@"
   ```

   Needs Node.js ≥ 18. No Node? Skip it — the skills read files directly.

4. **Memory.** Create `~/.rakz/memory/` with three files — `style.mns`,
   `persona.mns`, `journal.mns` — each containing only the line `%RAKZ 0.1`.

5. **Verify.** Start a session and ask your AI to "start a Rakz study loop".
   It should pick up the skills and begin from its memory core.

---

## Fallback bootstrap block

For harnesses with **no** skills support: copy `SOURCE/skills/` to
`~/.rakz/agent/skills/`, then add this block to the instructions file your
harness always loads (e.g. `AGENTS.md`):

```markdown
## Rakz Agent
When the user wants to memorize or study anything, act as the Rakz study
companion: read and follow, in order, the files
`~/.rakz/agent/skills/rakz-agent-memory/SKILL.md`,
`~/.rakz/agent/skills/rakz-study-loop/SKILL.md`, and
`~/.rakz/agent/skills/rakz-mns-format/SKILL.md` before starting the session.
If the user explicitly asks for a sweep over their mnemonic library, also
read `~/.rakz/agent/skills/rakz-library-loop/SKILL.md` first.
Speak the user's language.
```

---

## Uninstall

Delete the four `rakz-*` skill folders, `rakz-tutor.md`, the launcher
`~/.local/bin/mns` if you created it, and (if you want your memory and data
gone too) the `~/.rakz/` folder. That's everything.
