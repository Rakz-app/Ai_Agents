// ========== 2. TYPES ==========
// (None required for this file)
// ========== 3. CONSTANTS ==========
// (None required for this file)
// ========== 4. STATE ==========
// (None required for this file)
// ========== 5. LOGIC ==========
// ----- fromJson -----
// purpose: read a JSON export back into a document, filling in whatever the
//          export left out so the result is always a complete MnemoDocument
// io:      in --> JSON text | out --> MnemoDocument
// processes: (none)
function fromJson(rawText) {
    // 1. unreadable JSON yields an empty document rather than an exception:
    //    a reader never rejects its input (§2.3)
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    }
    catch {
        parsed = {};
    }
    // 2. every field falls back to the same default the parser would produce for
    //    a file that never mentioned it (§11)
    return {
        schemaVersion: parsed.schemaVersion ?? "0.1",
        flags: parsed.flags ?? [],
        root: parsed.root,
        hierarchy: parsed.hierarchy ?? [],
        mnemonics: parsed.mnemonics ?? [],
        fileNotes: parsed.fileNotes ?? [],
        closedImplicitly: parsed.closedImplicitly ?? false,
    };
}
// ----- toJson -----
// purpose: write the document out as a JSON export
// io:      in --> MnemoDocument | out --> JSON text
// processes: (none)
function toJson(doc) {
    // 1. two-space indentation keeps an export readable in any editor — the same
    //    principle the format itself follows: transparent, never opaque
    return JSON.stringify(doc, null, 2);
}
// ========== 6. MAIN / EXPORTS ==========
export { fromJson, toJson };
//# sourceMappingURL=bridges.js.map