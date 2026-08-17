import { parseMns } from "./parse.js";
import { serializeToMns } from "./serialize.js";
// ========== 2. TYPES ==========
// (None required for this file)
// ========== 3. CONSTANTS ==========
// (None required for this file)
// ========== 4. STATE ==========
// (None required for this file)
// ========== 5. LOGIC ==========
// ----- parseFile -----
// purpose: run the §15 detection algorithm, then parse — detection and parsing
//          are separate operations, because ".mns" is also an AutoCAD menu
//          extension and an unrecognised file must never be modified
// io:      in --> raw text, file extension, file path
//          out --> MnemoDocument, or null when the input is not recognised MNS
// processes: parseMns
function parseFile(raw, ext, path) {
    // 1. a magic line on the first line settles it immediately (§15)
    const firstLine = raw.split("\n", 1)[0] ?? "";
    if (/^\s*%rakz\b/i.test(firstLine)) {
        return parseMns(raw, path);
    }
    const extension = ext.toLowerCase().replace(/^\./, "");
    // 2. ".rkz" is ours alone, so the extension is enough; a save adds the
    //    missing magic line (§13)
    if (extension === "rkz") {
        return parseMns(raw, path);
    }
    // 3. ".mns" is shared with AutoCAD, so it needs a content check: at least one
    //    MNS prefix must appear at the start of some line
    if (extension === "mns") {
        const hasPrefix = raw.split("\n").some(line => /^\s*@[A-Za-z]*:/.test(line));
        return hasPrefix ? parseMns(raw, path) : null;
    }
    // 4. any other extension is not an MNS-format file. Returning null keeps a
    //    caller from writing to something it did not recognise; an application
    //    may still call parseMns directly at the user's explicit request (§15)
    return null;
}
// ----- canonicalize -----
// purpose: normalise MNS text by reading it and writing it back (§18)
// io:      in --> any MNS text | out --> its canonical form
// processes: parseMns, serializeToMns
function canonicalize(text) {
    // 1. read, then write: the round-trip law guarantees that parsing the result
    //    yields the same content as parsing the input (§18)
    return serializeToMns(parseMns(text));
}
// ========== 6. MAIN / EXPORTS ==========
export * from "./types.js";
export { parseMns, parseListValue, decodeLink, buildDocument, parseMagicLine } from "./parse.js";
export { serializeToMns } from "./serialize.js";
export { fromJson, toJson } from "./bridges.js";
export { parseFile, canonicalize };
//# sourceMappingURL=index.js.map