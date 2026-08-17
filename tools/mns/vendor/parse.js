// ============================================================
// parse.ts — MNS reader: outer boundary layer + inner field layer
// ============================================================
// ========== 3. CONSTANTS ==========
const OPEN = 1;
const CLOSE = 0;
// Every stored name and how it repeats (§9.2). Short and full spellings are
// listed separately because a line carries only one of them.
const FIELD_KINDS = {
    "": "single", title: "single",
    t: "list", tags: "list",
    k: "list", keyword: "list",
    c: "rich", context: "rich",
    imp: "single", importance: "single",
    s: "single", status: "single",
    hir: "single", hierarchy: "single",
    id: "single",
    sid: "single",
    ty: "single", type: "single",
    l: "list", links: "list",
};
// Short spelling -> canonical field name. A name absent here is already
// canonical (id, sid, and the full spellings).
const CANON = {
    "": "title", t: "tags", k: "keyword", c: "context",
    imp: "importance", s: "status", hir: "hierarchy",
    ty: "type",
    l: "links",
};
// ========== 4. STATE ==========
// (None — every function below is pure over its arguments)
// ========== 5. LOGIC ==========
// ----- classifyCutter -----
// purpose:   decide whether one trimmed line is a hard cutter, and which one
// io:        in --> trimmed line | out --> OPEN / CLOSE, or null for ordinary text
// processes: (none)
function classifyCutter(line) {
    // 1. a line that is exactly "mn===" opens a block (§16.1)
    if (line === "mn===")
        return OPEN;
    // 2. a line that is exactly "===end" closes one
    if (line === "===end")
        return CLOSE;
    // 3. anything else is ordinary text — cutters are never recognised mid-line
    return null;
}
// ----- decodeLink -----
// purpose:   read one list item as a link, per the §10.3 contract
// io:        in --> raw item text | out --> Link (never null: every item decodes)
// processes: (none)
function decodeLink(raw) {
    // 1. no pipe at all: a title with NO target — a reader must not invent one
    const lastPipeIndex = raw.lastIndexOf("|");
    if (lastPipeIndex === -1) {
        return { title: raw, targetSID: null };
    }
    // 2. the LAST pipe separates, so a title may itself contain pipes with no
    //    escape mechanism ("A|B|42" is the title "A|B" pointing at "42")
    const title = raw.substring(0, lastPipeIndex);
    const target = raw.substring(lastPipeIndex + 1).trim();
    // 3. the target is stored exactly as written; an empty side means no target.
    //    Casting it to a number is engine policy, not the format's (§14).
    return { title, targetSID: target === "" ? null : target };
}
// ----- makeT -----
// purpose:   close the current line buffer as ONE text run, with its case
// io:        in --> buffered lines, cutter indexes, start line, previous cutter
//            out --> a T token (the edge rule is applied later by forceEdgeCase)
// processes: (none)
function makeT(lines, cutters, start, prevQ) {
    // 1. a run governed by a hard open is sovereign; every other run is free
    const tCase = prevQ === OPEN ? "GREED" : "EQUALIZER";
    return { kind: "T", lines, cutters, start, case: tCase };
}
// ----- separateTextByQAndType -----
// purpose:   outer layer, stage 1 — split the file into the alternating
//            stream T, Q, T, Q, …, T (§16.1)
// io:        in --> the whole file text | out --> the token stream
// processes: classifyCutter, makeT
// invariant: starts with a T and ends with a T; never T after T, never Q after Q
function separateTextByQAndType(text) {
    const tokens = [];
    let prevQ = null; // the last hard cutter — text never moves it
    let buf = [];
    let cutters = [];
    let start = 0;
    // 1. closing the buffer is needed both at every cutter and at end of input,
    //    so it lives in one place
    const flush = () => {
        tokens.push(makeT(buf, cutters, start, prevQ));
        buf = [];
        cutters = [];
    };
    // 2. walk the file line by line; trimming first, since cutters and prefixes
    //    are tested against the trimmed form (§16.2)
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        // the index is always in range, so the ?? "" never fires at runtime
        const t = (lines[i] ?? "").trim();
        const q = classifyCutter(t);
        // 3. an ordinary line joins the open run — remembering where the run began
        //    and where its title fingerprints sit
        if (q === null) {
            if (buf.length === 0)
                start = i;
            if (/^@(title)?:/i.test(t))
                cutters.push(buf.length);
            buf.push(t);
            continue;
        }
        // 4. a cutter ends the run above it, then becomes a token of its own
        flush();
        tokens.push({ kind: "Q", bit: q, line: i });
        prevQ = q;
        start = i + 1;
    }
    // 5. end of input closes the last run — this is what keeps the stream
    //    ending on a T
    flush();
    return tokens;
}
// ----- forceEdgeCase -----
// purpose:   apply the edge rule (§16.1) — the file's first and last runs are
//            always free, so an orphan open loses its sovereignty
// io:        in --> the token stream | out --> the same stream, edges corrected
// processes: (none)
function forceEdgeCase(tokens) {
    // 1. an empty stream has no edges to correct
    if (tokens.length === 0)
        return tokens;
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    // 2. the file head is free: nothing above it drew a boundary.
    //    (the undefined checks can never fire — length was tested above)
    if (first !== undefined && first.kind === "T")
        first.case = "EQUALIZER";
    // 3. the tail of a never-closed "mn===" is free too: fingerprints split it
    if (last !== undefined && last.kind === "T")
        last.case = "EQUALIZER";
    return tokens;
}
// ----- toMnemonics -----
// purpose:   outer layer, stage 2 — turn the token stream into raw mnemonic
//            blocks plus file notes. Boundaries only; fields are readCard's job
// io:        in --> the token stream | out --> { blocks, fileNotes }
// processes: (none)
function toMnemonics(tokens) {
    const blocks = [];
    const fileNotes = [];
    // 1. walk the stream; each token is either a cutter or a run
    for (let i = 0; i < tokens.length; i++) {
        // the index is always in range — the guard only satisfies the compiler
        const tk = tokens[i];
        if (tk === undefined)
            continue;
        // 2. an orphan close — one whose run above holds nothing eligible to close
        //    — recovers an open over itself, yielding one empty mnemonic (§17).
        //    tokens[i - 1] always exists here: the stream starts with a T
        if (tk.kind === "Q") {
            if (tk.bit === CLOSE) {
                const prev = tokens[i - 1];
                if (prev !== undefined && prev.kind === "T" && prev.case === "EQUALIZER" && prev.cutters.length === 0) {
                    blocks.push({ text: "", mode: "GREED" });
                }
            }
            continue;
        }
        // 3. a sovereign run is exactly ONE mnemonic whatever it holds — the
        //    boundary created it, even when the run is empty (§16.1)
        if (tk.case === "GREED") {
            blocks.push({ text: tk.lines.join("\n"), mode: "GREED" });
            continue;
        }
        // 4. in a free run, everything above the first fingerprint is file notes;
        //    blank lines there are not content, so they are dropped (§16.1).
        //    blocks.length is how many mnemonics stand above the note — the count a
        //    rewrite needs to put it back in place (§18)
        const cuts = tk.cutters;
        const firstCut = cuts[0];
        const headEnd = firstCut !== undefined ? firstCut : tk.lines.length;
        for (let j = 0; j < headEnd; j++) {
            const text = tk.lines[j];
            if (text !== undefined && text !== "") {
                fileNotes.push({ text, line: tk.start + j, afterBlock: blocks.length });
            }
        }
        // 5. then each fingerprint opens one mnemonic, running to the next
        //    fingerprint or to the end of the run
        for (let c = 0; c < cuts.length; c++) {
            const to = cuts[c + 1] ?? tk.lines.length;
            blocks.push({ text: tk.lines.slice(cuts[c], to).join("\n"), mode: "EQUALIZER" });
        }
    }
    return { blocks, fileNotes };
}
// ----- readCard -----
// purpose:   inner layer — cut ONE block into raw field text plus notes,
//            interpreting nothing (§16.2)
// io:        in --> the block's lines, its case, whether canon mode is on
//            out --> a Card: { fields, notes, closedImplicitly }
// processes: (none)
//
// The rule, in one line: a prefix that CAN open cuts; one that cannot is
// swallowed if a value is open, and becomes a note otherwise.
//
// In canon mode the only legitimate closer is "!@": every other line —
// including prefixes that could otherwise open — is swallowed while a value is
// open. A block that ends with a value still open closes it structurally and
// raises closedImplicitly, which means a canon file lost a "!@".
//
// `mode` is deliberately unused: it is kept in the signature because the block's
// case is part of the agreed interface between the two layers, and because the
// documented reading of a block depends on it even where the code does not.
function readCard(lines, mode, cMode) {
    const fields = {};
    const notes = [];
    let open = null;
    // 1. closing an open value: trim the blank edges the author did not mean as
    //    content, then store or merge it per the field's kind (§9.1)
    const close = () => {
        if (!open)
            return;
        const parts = [...open.parts];
        while (parts.length > 0 && parts[0] === "")
            parts.shift();
        while (parts.length > 0 && parts[parts.length - 1] === "")
            parts.pop();
        const v = parts.join("\n");
        if (!(open.canon in fields))
            fields[open.canon] = v;
        else if (open.kind === "list")
            fields[open.canon] += v ? "\n" + v : "";
        else if (open.kind === "rich")
            fields[open.canon] += v ? "\n" + v : "";
        open = null;
    };
    // 2. read the block top to bottom against one open value at a time
    for (const line of lines) {
        // 3. canon mode first: while a value is open, only "!@" is structural
        if (cMode && open !== null && line !== "!@") {
            open.parts.push(line);
            continue;
        }
        // 4. read the line's prefix, if it has one. Looking the name up in
        //    FIELD_KINDS is what "stored" means: a defined kind IS the proof that
        //    the name is one we know, so no assertion is needed below
        const prefix = /^@([A-Za-z]*):/.exec(line);
        const name = prefix !== null ? (prefix[1] ?? "").toLowerCase() : null;
        const kind = name !== null ? FIELD_KINDS[name] : undefined;
        // 5. a stored prefix: it either opens its field, or loses and is kept
        if (prefix !== null && name !== null && kind !== undefined) {
            const canon = CANON[name] ?? name;
            // a field still open counts as present — "@: B" after "@: A" cannot open
            const openSame = open !== null && open.canon === canon;
            const present = (canon in fields) || openSame;
            const canOpen = !present || kind !== "single";
            if (canOpen) {
                // 6. it can open: it closes whatever was open, then opens its own.
                //    A value that starts on the prefix line stays open like any other
                close();
                const rest = line.slice(prefix[0].length).trim();
                open = { canon, kind, parts: rest ? [rest] : [] };
            }
            else if (open) {
                // 7. it lost and a value is open: swallowed exactly where it was written
                open.parts.push(line);
            }
            else {
                // 8. it lost with nothing open: preserved as a card note
                notes.push(line);
            }
            continue;
        }
        // 9. a lone "!@" closes an open value, or is an orphan note
        if (line === "!@") {
            if (open)
                close();
            else
                notes.push(line);
            continue;
        }
        // 10. any other line — plain text, or a prefix-shaped line with an unknown
        //     name — is swallowed if a value is open, else kept as a note.
        //     Blank lines outside a value are not content
        if (open)
            open.parts.push(line);
        else if (line !== "")
            notes.push(line);
    }
    // 11. the block ended: in canon mode a still-open value means a "!@" was
    //     dropped, which the flag reports. Tolerant mode closes implicitly by
    //     design, so it never raises the flag
    const closedImplicitly = cMode && open !== null;
    close();
    return { fields, notes, closedImplicitly };
}
// ----- parseListValue -----
// purpose:   read one merged list field: the dash at the start of a line is the
//            ONLY separator; every other line joins the item above it (§7)
// io:        in --> the field's raw text (or undefined)
//            out --> { items, headNotes } — head lines belong to no item
// processes: (none)
function parseListValue(rawVal) {
    const items = [];
    const headNotes = [];
    // 1. an unset field has neither items nor head lines
    if (!rawVal)
        return { items, headNotes };
    // 2. an item ends where the next one begins; its trailing blank lines are
    //    layout, not content
    const pushItem = (parts) => {
        while (parts.length > 0 && parts[parts.length - 1] === "")
            parts.pop();
        items.push(parts.join("\n"));
    };
    // 3. walk the value; `current` is the item still collecting lines
    let current = null;
    for (const line of rawVal.split("\n")) {
        // 4. a dash closes the previous item and opens a new one
        if (line.startsWith("-")) {
            if (current)
                pushItem(current);
            current = [line.slice(1).trim()];
        }
        else if (current) {
            // 5. any other line continues the open item — blank ones included,
            //    since they are formatting the author wrote
            current.push(line);
        }
        else if (line !== "") {
            // 6. before the first dash nothing is open, so the line belongs to no
            //    item: it is note material (§7)
            headNotes.push(line);
        }
    }
    // 7. end of value closes the last item
    if (current)
        pushItem(current);
    return { items, headNotes };
}
// ----- parseMagicLine -----
// purpose:   read the magic line "%RAKZ <version> [flags…]" — the FIRST
//            physical line only (§13); a %RAKZ line anywhere else is a note
// io:        in --> the file's first line | out --> { version, flags }, or null
// processes: (none)
function parseMagicLine(line) {
    // 1. split into whitespace-separated tokens; the keyword is matched
    //    case-insensitively, like the rest of the line (§16.2)
    const tokens = line.trim().split(/\s+/).filter(t => t !== "");
    const head = tokens[0];
    // 2. no keyword, no magic line — the caller then keeps its own defaults
    if (head === undefined || !/^%rakz$/i.test(head))
        return null;
    // 3. the version is the next token; flags follow it, lowercased as read so
    //    unknown ones survive a rewrite unchanged (§2.2)
    return { version: tokens[1] ?? "0.1", flags: tokens.slice(2).map(t => t.toLowerCase()) };
}
// ----- findSettingsCutoff -----
// purpose:   locate where the settings region ends — the file head stops at the
//            first fingerprint or the first hard cutter, whichever comes first (§12)
// io:        in --> the file's lines | out --> the line index where the head ends
// processes: (none)
function findSettingsCutoff(lines) {
    // 1. scan from the top for whichever boundary appears first
    for (let i = 0; i < lines.length; i++) {
        const t = (lines[i] ?? "").trim();
        if (t === "mn===" || t === "===end" || /^@(title)?:/i.test(t))
            return i;
    }
    // 2. neither appeared: the whole file is head (a notes-only document)
    return lines.length;
}
// ----- optional -----
// purpose:   spread one optional field only when the file carried it, so that
//            "absent" is a missing property everywhere and never a present
//            property holding undefined
// io:        in --> field name, raw value | out --> { name: value }, or {}
// processes: (none)
function optional(name, value) {
    // 1. a field the file never mentioned adds nothing to the object
    if (value === undefined)
        return {};
    // 2. otherwise it is carried through exactly as read
    return { [name]: value };
}
// ----- buildDocument -----
// purpose:   cast the raw string cards into a strict MnemoDocument, applying
//            the field contracts of §9–§11
// io:        in --> { mnemonics, fileNotes, magic, cutoff }
//            out --> MnemoDocument
// processes: parseListValue, decodeLink, optional
function buildDocument(raw) {
    let root = undefined;
    let hierarchy = [];
    let hirSeen = false;
    const consumed = new Set();
    // 1. the magic line is a note by the outer layer's reckoning; consuming it
    //    here keeps it from being written back as one
    if (raw.magic !== null)
        consumed.add(0);
    // 2. sweep the head region only (§12): the first @ROOT: and the first
    //    @hir:/@hierarchy: win. Later ones, and any past the cutoff, stay notes
    for (const note of raw.fileNotes) {
        if (note.line >= raw.cutoff)
            continue;
        const text = note.text.trim();
        const lower = text.toLowerCase();
        if (root === undefined && lower.startsWith("@root:")) {
            root = text.substring(text.indexOf(":") + 1).trim();
            consumed.add(note.line);
        }
        else if (!hirSeen && (lower.startsWith("@hir:") || lower.startsWith("@hierarchy:"))) {
            hirSeen = true;
            hierarchy = text.substring(text.indexOf(":") + 1).trim().split("/").filter(h => h !== "");
            consumed.add(note.line);
        }
    }
    // 3. whatever the sweep did not claim stays a file note, in place
    const fileNotes = raw.fileNotes.filter(n => !consumed.has(n.line));
    // 4. turn each card's raw text into a typed mnemonic
    const mnemonics = [];
    for (const card of raw.mnemonics) {
        const f = card.fields;
        const notes = [...card.notes];
        // 5. list fields: their items, and their head lines joining the card notes
        const tagsList = parseListValue(f["tags"]);
        notes.push(...tagsList.headNotes);
        const keywordList = parseListValue(f["keyword"]);
        notes.push(...keywordList.headNotes);
        // 6. links: every item decodes (§10.3) — no pipe means a title with no
        //    target, an empty side means null. Nothing is demoted to a note
        const linksList = parseListValue(f["links"]);
        notes.push(...linksList.headNotes);
        const links = linksList.items.map(decodeLink);
        // 7. every optional field is spread only when the file actually carried it,
        //    so "absent" is one state throughout the document. In particular an
        //    absent status stays absent: §11's "active" default is interpretive,
        //    applied by the engine, never materialised here
        mnemonics.push({
            title: f["title"] ?? "", // "" = untitled (§11)
            ...optional("id", f["id"]),
            ...optional("type", f["type"]),
            ...optional("importance", f["importance"]), // stored as written (§9.2)
            ...optional("status", f["status"]),
            ...optional("hierarchy", f["hierarchy"]), // mnemonic-level path (§9.2)
            ...optional("sid", f["sid"]), // stored as written (§10.2)
            tags: tagsList.items,
            keywords: keywordList.items,
            context: f["context"] ?? "", // "" = absent (§11)
            links,
            notes,
        });
    }
    // 9. a document with no magic line is read with 0.1's defaults (§23)
    return {
        schemaVersion: raw.magic !== null ? raw.magic.version : "0.1",
        flags: raw.magic !== null ? raw.magic.flags : [],
        root,
        hierarchy,
        mnemonics,
        fileNotes,
        closedImplicitly: raw.mnemonics.some(c => c.closedImplicitly),
    };
}
// ----- parseMns -----
// purpose:   read MNS text into a document — the whole pipeline, in order
// io:        in --> the file text (filePath is reserved for §15 detection,
//            which lives in parseFile) | out --> MnemoDocument
// processes: parseMagicLine, findSettingsCutoff, separateTextByQAndType,
//            forceEdgeCase, toMnemonics, readCard, buildDocument
function parseMns(rawText, filePath) {
    // 1. the first line decides the version and the reading mode; the head
    //    boundary decides how far settings may be read (§12, §13)
    const lines = rawText.split("\n");
    const magic = parseMagicLine(lines[0] ?? "");
    const cMode = magic !== null && (magic.flags.includes("c") || magic.flags.includes("canon"));
    const cutoff = findSettingsCutoff(lines);
    // 2. outer layer: split on hard cutters, then correct the edges
    const tokens = forceEdgeCase(separateTextByQAndType(rawText));
    // 3. outer layer: turn runs into blocks and file notes
    const { blocks, fileNotes } = toMnemonics(tokens);
    // 4. inner layer: cut each block into raw fields and notes
    const rawCards = blocks.map((b) => readCard(b.text.split("\n"), b.mode, cMode));
    // 5. cast the raw text into the typed document
    return buildDocument({ mnemonics: rawCards, fileNotes, magic, cutoff });
}
// ========== 6. MAIN / EXPORTS ==========
export { parseMns, buildDocument, parseListValue, parseMagicLine, decodeLink };
//# sourceMappingURL=parse.js.map