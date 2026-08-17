// ========== 2. TYPES ==========
// (None required for this file)
// ========== 3. CONSTANTS ==========
// (None required for this file)
// ========== 4. STATE ==========
// (None required for this file)
// ========== 5. LOGIC ==========
// ----- pushScalar -----
// purpose: write one scalar field in canonical shape (§18) — prefix on its own
//          line, value below it, explicit strong closer, no blank separator
// io:      in --> output array, prefix, value, `always` | out --> void
// processes: (none)
function pushScalar(output, prefix, value, always = false) {
    // 1. an unset or empty field is simply not written (§11) — unless it is one
    //    of the two anchors, which appear in every canonical mnemonic (§18)
    if (!always && (value === undefined || value === null || value === ""))
        return;
    output.push(prefix);
    // 2. an empty anchor writes its prefix and closer with no value line between
    //    them, since empty and absent are one state (§11)
    const text = String(value ?? "");
    if (text !== "")
        output.push(text);
    output.push("!@");
}
// ----- pushList -----
// purpose: write one list field in canonical shape — one item per line, each
//          a dash immediately followed by the item (§18)
// io:      in --> output array, prefix, items | out --> void
// processes: (none)
function pushList(output, prefix, items) {
    // 1. an empty list is not written at all (§18)
    if (items.length === 0)
        return;
    output.push(prefix);
    // 2. each item begins with a dash; a multi-line item writes its first line
    //    dashed and its continuation lines plain, which is how they read back (§7)
    for (const item of items) {
        const itemLines = item.split("\n");
        output.push(`-${itemLines[0] ?? ""}`);
        for (let i = 1; i < itemLines.length; i++) {
            output.push(itemLines[i] ?? "");
        }
    }
    output.push("!@");
}
// ----- encodeLink -----
// purpose: encode one Link as the list item "TITLE|target" (§10.3)
// io:      in --> Link | out --> the encoded item text
// processes: (none)
function encodeLink(link) {
    // 1. the pipe is ALWAYS written, so a null target leaves it trailing. That
    //    keeps the last-pipe rule intact for titles that contain pipes:
    //    {title "A|B", no target} encodes as "A|B|" and reads back the same
    return `${link.title}|${link.targetSID ?? ""}`;
}
// ----- pushMnemonic -----
// purpose: write one Mnemonic as an explicit mn=== … ===end block, in the
//          canonical region order title -> attributes -> context -> notes (§18)
// io:      in --> output array, Mnemonic | out --> void
// processes: pushScalar, pushList, encodeLink
function pushMnemonic(output, mnemo) {
    output.push("mn===");
    // 1. the title anchor opens every mnemonic, even when empty (§18)
    pushScalar(output, "@title:", mnemo.title, true);
    // 2. then the attributes, in the stored-name order of §9.2. Unset fields and
    //    empty lists are skipped by the helpers; an absent status is never
    //    written, because §11's default is the engine's to apply
    pushList(output, "@tags:", mnemo.tags);
    pushList(output, "@keyword:", mnemo.keywords);
    pushScalar(output, "@importance:", mnemo.importance);
    pushScalar(output, "@status:", mnemo.status);
    pushScalar(output, "@type:", mnemo.type);
    pushScalar(output, "@hierarchy:", mnemo.hierarchy);
    pushScalar(output, "@id:", mnemo.id);
    pushScalar(output, "@sid:", mnemo.sid);
    // 3. links are written only when there is at least one (§18)
    if (mnemo.links.length > 0) {
        pushList(output, "@links:", mnemo.links.map(encodeLink));
    }
    // 4. the context anchor closes the field region, empty or not (§18)
    pushScalar(output, "@context:", mnemo.context, true);
    // 5. card notes stay inside their mnemonic, after the fields. Re-parsing
    //    returns them to notes unchanged: a losing prefix still loses because its
    //    field was written above, and an orphan "!@" is still orphaned
    for (const note of mnemo.notes) {
        output.push(note);
    }
    output.push("===end");
}
// ----- isSafeInHead -----
// purpose: decide whether one file note can stand in the settings region
//          without the next read changing what it means (§12)
// io:      in --> the note's text, the document it belongs to
//          out --> true when the head is safe for it
// processes: (none)
function isSafeInHead(text, doc) {
    const line = text.trim().toLowerCase();
    // 1. a note shaped like @ROOT: is safe only when a real ROOT setting stands
    //    above it: the sweep takes the FIRST occurrence (§12), so the note is
    //    then a duplicate and stays a note
    if (line.startsWith("@root:"))
        return doc.root !== undefined;
    // 2. the hierarchy setting is checked by its own name — a written ROOT does
    //    not shield an @hir: note, and the two must never be conflated
    if (line.startsWith("@hir:") || line.startsWith("@hierarchy:")) {
        return doc.hierarchy.length > 0;
    }
    // 3. anything else is not setting-shaped, so the head cannot change it
    return true;
}
// ----- pushNotes -----
// purpose: write a run of file notes, in the order they were stored
// io:      in --> output array, the notes | out --> void
// processes: (none)
function pushNotes(output, notes) {
    for (const note of notes) {
        output.push(note.text);
    }
}
// ----- buildMagicLine -----
// purpose: build the canonical magic line "%RAKZ <version> canon [flags…]"
//          (§13, §18)
// io:      in --> schema version, flags as read | out --> the magic line
// processes: (none)
function buildMagicLine(schemaVersion, flags) {
    // 1. drop both spellings of the canon flag: the canonical line writes it
    //    once, in its full form (§18 uses full names everywhere)
    const kept = flags.filter(f => f !== "c" && f !== "canon");
    // 2. unknown flags survive verbatim, in their stored order, so a file written
    //    by a newer tool keeps its declarations through our rewrite (§2.2)
    return ["%RAKZ", schemaVersion, "canon", ...kept].join(" ");
}
// ----- serializeToMns -----
// purpose: write a MnemoDocument out in the canonical form (§18)
// io:      in --> MnemoDocument | out --> the canonical text
// processes: buildMagicLine, isSafeInHead, pushNotes, pushMnemonic
function serializeToMns(doc) {
    const output = [];
    // 1. the magic line comes first, always carrying the canon flag — that is
    //    what makes the round-trip law hold by construction (§18)
    output.push(buildMagicLine(doc.schemaVersion, doc.flags));
    // 2. then the settings, ROOT before hir. Their values stay on the prefix
    //    line, because the settings sweep reads one line at a time (§12)
    if (doc.root) {
        output.push(`@ROOT: ${doc.root}`);
    }
    if (doc.hierarchy.length > 0) {
        output.push(`@hir: /${doc.hierarchy.join("/")}`);
    }
    // 3. each note goes back where it stood: afterBlock counts the mnemonics
    //    above it, so notesAt(i) is everything written between block i-1 and
    //    block i, and notesAt(count) is what trailed the last block (§18)
    const notesAt = (index) => doc.fileNotes.filter(note => note.afterBlock === index);
    const [first, ...rest] = doc.mnemonics;
    if (first !== undefined) {
        // 4. head notes stay in the head — except one class. A setting-shaped note
        //    with no setting of the same name above it would be read AS that
        //    setting next time (§12), so keeping its position would change its
        //    meaning. Where the two conflict the meaning wins, and the note moves
        //    below the first block, out of the settings region (§18)
        const head = notesAt(0);
        pushNotes(output, head.filter(note => isSafeInHead(note.text, doc)));
        pushMnemonic(output, first);
        pushNotes(output, head.filter(note => !isSafeInHead(note.text, doc)));
        // 5. then every later block, each preceded by the notes that stood above it
        for (let i = 0; i < rest.length; i++) {
            const mnemo = rest[i];
            if (mnemo === undefined)
                continue; // rest is dense; this only narrows
            pushNotes(output, notesAt(i + 1));
            pushMnemonic(output, mnemo);
        }
        // 6. and whatever trailed the last block
        pushNotes(output, notesAt(doc.mnemonics.length));
    }
    else {
        // 7. with no mnemonic at all there is no block to write below, so an unsafe
        //    note needs a bare "mn===" above it. An orphan open loses its
        //    sovereignty (§16.1) and yields no mnemonic (§17), so the document
        //    still reads as zero mnemonics — a fixed point with no new syntax
        if (doc.fileNotes.some(note => !isSafeInHead(note.text, doc))) {
            output.push("mn===");
        }
        pushNotes(output, doc.fileNotes);
    }
    // 8. the file ends with a single trailing newline (§18)
    return output.join("\n").replace(/\n*$/, "\n");
}
// ========== 6. MAIN / EXPORTS ==========
export { serializeToMns };
//# sourceMappingURL=serialize.js.map