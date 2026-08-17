#!/usr/bin/env node
// mns — internal CLI for the Rakz agent.
// Thin wrapper over the vendored mns-parser (see vendor/NOTICE.md).
// Subcommands: list, query, append. Output is intentionally small: this tool
// exists so an AI agent can retrieve a few blocks instead of reading whole files.

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, appendFileSync, renameSync } from "node:fs";
import { extname, join, dirname, basename } from "node:path";
import { parseFile, parseMns, serializeToMns } from "./vendor/index.js";

const HELP = `mns — Rakz mnemonic files, from the command line

usage:
  mns list  <path...>                     one line per block: title, id, keywords, imp
  mns query <path...> -k <word> [opts]    print only the blocks that match
  mns append <file>                       append one MNS block read from stdin
  mns set <file> <selector> <edits...>    edit fields of ONE block (parse → edit → serialize)

query options:
  -k <word>      match in keywords, title, or tags (case-insensitive)
  -t <tag>       require this tag
  --imp-min <n>  require importance >= n
  --limit <n>    max blocks to print (default 10)
  --json         JSON output instead of MNS blocks

set — selector (must match exactly one block):
  --id <x>            block whose @id: is x (preferred)
  --title <t>         block whose title is exactly t
  --nth <n>           the n-th block of the file (1-based, as shown by list)
set — edits (one or more):
  --imp <v> | --status <v> | --type <v> | --set-title <v> | --set-id <v>
  --set-context <v>   replace the context (add --keep-old to keep the old
                      text as a card note instead of losing it)
  --add-context <v>   append a line to the context (evidence grows, nothing lost)
  --add-tag <v>       add a tag         --add-keyword <v>   add a keyword
note: set rewrites the file in canonical form (spec §18) — content is
preserved by the round-trip law; layout is normalized.

paths may be files or directories (searched recursively for .mns / .rkz).`;

// ---------- shared ----------

function fail(msg) { process.stderr.write(msg + "\n"); process.exit(1); }

function expandPaths(args) {
  const files = [];
  for (const p of args) {
    if (!existsSync(p)) fail(`mns: no such path: ${p}`);
    if (statSync(p).isDirectory()) {
      for (const entry of readdirSync(p, { recursive: true })) {
        const full = join(p, String(entry));
        if (/\.(mns|rkz)$/i.test(full) && statSync(full).isFile()) files.push(full);
      }
    } else {
      files.push(p);
    }
  }
  return files;
}

function loadDocs(files) {
  const docs = [];
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const doc = parseFile(raw, extname(file), file);
    if (doc === null) {
      process.stderr.write(`mns: skipped (not MNS format): ${file}\n`);
      continue;
    }
    docs.push({ file, doc });
  }
  return docs;
}

function importanceOf(m) {
  const n = parseFloat(m.importance ?? "");
  return Number.isFinite(n) ? n : null;
}

// ---------- list ----------

function cmdList(paths) {
  if (paths.length === 0) fail("mns list: give at least one file or directory");
  for (const { file, doc } of loadDocs(expandPaths(paths))) {
    process.stdout.write(`${file}  (${doc.mnemonics.length} blocks)\n`);
    const flat = s => s.replace(/\n/g, " ⏎ ");
    for (const m of doc.mnemonics) {
      const imp = m.importance ? `[${m.importance}] ` : "";
      const title = flat(m.title || "(untitled)");
      const id = m.id ? `  {${flat(m.id)}}` : "";
      const kws = m.keywords.length ? `  ~k: ${flat(m.keywords.join(", "))}` : "";
      const tags = m.tags.length ? `  #${flat(m.tags.join(" #"))}` : "";
      const status = m.status && !["active", "1"].includes(m.status) ? `  (${m.status})` : "";
      process.stdout.write(`  ${imp}${title}${id}${kws}${tags}${status}\n`);
    }
  }
}

// ---------- query ----------

function parseQueryArgs(args) {
  const opts = { paths: [], k: null, t: null, impMin: null, limit: 10, json: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-k") opts.k = args[++i];
    else if (a === "-t") opts.t = args[++i];
    else if (a === "--imp-min") opts.impMin = parseFloat(args[++i]);
    else if (a === "--limit") opts.limit = parseInt(args[++i], 10);
    else if (a === "--json") opts.json = true;
    else if (a.startsWith("-")) fail(`mns query: unknown option ${a}\n\n${HELP}`);
    else opts.paths.push(a);
  }
  if (opts.paths.length === 0) fail("mns query: give at least one file or directory");
  if (opts.k === null && opts.t === null && opts.impMin === null)
    fail("mns query: give at least one filter (-k, -t, or --imp-min)");
  return opts;
}

function matches(m, opts) {
  if (opts.k !== null) {
    const needle = opts.k.toLowerCase();
    const haystack = [...m.keywords, m.title, ...m.tags].join("\n").toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  if (opts.t !== null && !m.tags.some(t => t.toLowerCase() === opts.t.toLowerCase())) return false;
  if (opts.impMin !== null) {
    const imp = importanceOf(m);
    if (imp === null || imp < opts.impMin) return false;
  }
  return true;
}

function cmdQuery(args) {
  const opts = parseQueryArgs(args);
  const hits = [];
  for (const { file, doc } of loadDocs(expandPaths(opts.paths)))
    for (const m of doc.mnemonics) if (matches(m, opts)) hits.push({ file, m });

  const shown = hits.slice(0, opts.limit);
  if (opts.json) {
    process.stdout.write(JSON.stringify(shown.map(({ file, m }) => ({
      file, title: m.title, context: m.context, keywords: m.keywords,
      tags: m.tags, importance: m.importance ?? null, status: m.status ?? "active",
    })), null, 2) + "\n");
  } else {
    for (const { file, m } of shown) {
      process.stdout.write(`# from: ${file}\n`);
      const doc = { schemaVersion: "0.1", flags: [], mnemonics: [m],
                    hierarchy: [], fileNotes: [], closedImplicitly: false };
      // drop the magic line the serializer emits — we print blocks, not files
      process.stdout.write(serializeToMns(doc).replace(/^\s*%rakz[^\n]*\n/i, "") + "\n");
    }
  }
  process.stderr.write(`mns: ${hits.length} match(es), showing ${shown.length}\n`);
}

// ---------- append ----------

function cmdAppend(args) {
  const [file] = args;
  if (!file) fail("mns append: give the target file");
  const block = readFileSync(0, "utf8").trim();
  if (!block) fail("mns append: nothing on stdin");
  const doc = parseMns(block, file);
  if (doc.mnemonics.length === 0)
    fail("mns append: stdin does not contain a valid mnemonic block — nothing written");
  if (!existsSync(file)) {
    writeFileSync(file, "%RAKZ 0.1\n\n" + block + "\n");
  } else {
    const raw = readFileSync(file, "utf8");
    const sep = raw.endsWith("\n") ? "\n" : "\n\n";
    appendFileSync(file, sep + block + "\n"); // existing bytes are never touched
  }
  process.stderr.write(`mns: appended ${doc.mnemonics.length} block(s) to ${file}\n`);
}

// ---------- set ----------

function parseSetArgs(args) {
  const sel = { id: null, title: null, nth: null };
  const edits = [];
  let file = null, keepOld = false;
  const takes = {
    "--id": v => (sel.id = v), "--title": v => (sel.title = v),
    "--nth": v => (sel.nth = parseInt(v, 10)),
    "--imp": v => edits.push(m => (m.importance = v)),
    "--status": v => edits.push(m => (m.status = v)),
    "--type": v => edits.push(m => (m.type = v)),
    "--set-title": v => edits.push(m => (m.title = v)),
    "--set-id": v => edits.push(m => (m.id = v)),
    "--set-context": v => edits.push(m => {
      if (keepOld && m.context) m.notes.push("old context: " + m.context);
      m.context = v;
    }),
    "--add-context": v => edits.push(m => (m.context = m.context ? m.context + "\n" + v : v)),
    "--add-tag": v => edits.push(m => m.tags.push(v)),
    "--add-keyword": v => edits.push(m => m.keywords.push(v)),
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--keep-old") keepOld = true;
    else if (takes[a]) {
      const v = args[++i];
      if (v === undefined) fail(`mns set: ${a} needs a value`);
      takes[a](v);
    }
    else if (a.startsWith("-")) fail(`mns set: unknown option ${a}\n\n${HELP}`);
    else if (file === null) file = a;
    else fail(`mns set: unexpected argument "${a}"`);
  }
  return { file, sel, edits };
}

function cmdSet(args) {
  const { file, sel, edits } = parseSetArgs(args);
  if (!file) fail("mns set: give the target file");
  if (sel.id === null && sel.title === null && sel.nth === null)
    fail("mns set: give a selector (--id, --title, or --nth)");
  if (edits.length === 0) fail("mns set: give at least one edit");
  if (!existsSync(file)) fail(`mns set: no such file: ${file}`);

  const raw = readFileSync(file, "utf8");
  const doc = parseFile(raw, extname(file), file);
  if (doc === null) fail(`mns set: not recognized as MNS format, refusing to touch: ${file}`);

  let targets;
  if (sel.nth !== null) {
    targets = doc.mnemonics[sel.nth - 1] ? [doc.mnemonics[sel.nth - 1]] : [];
  } else {
    targets = doc.mnemonics.filter(m =>
      (sel.id === null || m.id === sel.id) && (sel.title === null || m.title === sel.title));
  }
  if (targets.length === 0) fail("mns set: selector matched no block — nothing written");
  if (targets.length > 1)
    fail(`mns set: selector matched ${targets.length} blocks — be more specific; nothing written`);

  for (const edit of edits) edit(targets[0]);

  // atomic write: same directory, then rename over the original
  const tmp = join(dirname(file), "." + basename(file) + ".mns-tmp");
  writeFileSync(tmp, serializeToMns(doc));
  renameSync(tmp, file);
  process.stderr.write(`mns: applied ${edits.length} edit(s) to "${targets[0].title || "(untitled)"}" in ${file}\n`);
}

// ---------- main ----------

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "list") cmdList(rest);
else if (cmd === "query") cmdQuery(rest);
else if (cmd === "append") cmdAppend(rest);
else if (cmd === "set") cmdSet(rest);
else if (cmd === "--help" || cmd === "-h" || cmd === undefined) process.stdout.write(HELP + "\n");
else fail(`mns: unknown command "${cmd}"\n\n${HELP}`);
