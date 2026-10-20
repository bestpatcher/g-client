// Renames the user-visible product name "Equicord" to "$G" in the client source.
// Only touches text a person can see. Identifiers, import paths, URLs, data folders,
// user agents and badge/donor strings are left alone on purpose (the client breaks otherwise).
// Run from the repo root: node g-rename.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";

const NAME = "$G";
const ROOT = "src";
const EXTS = new Set([".ts", ".tsx"]);

// files / folders that must keep the original name
const SKIP_PATHS = [
    "src/shared/vencordUserAgent.ts",
    "src/main/utils/extensions.ts",
    "src/equicordplugins/musicControls",
    "src/plugins/_api/badges",
    "src/equicordplugins/showBadgesInChat",
    "src/equicordplugins/globalBadges",
    "src/equicordplugins/loginWithQR",
].map(p => p.split("/").join(sep));

// lines that must keep the original name (data folders on disk, websocket/url queries)
const SKIP_LINE = [
    /"\.\."\s*,\s*"Equicord"/,
    /ws:\/\//,
];

// an occurrence is only replaced when it stands alone as a word in text
const OCCURRENCE = /(?<![A-Za-z0-9_$\/.@#=\-])Equicord(?![A-Za-z0-9_\/]|\.(?:[A-Za-z_]|org|com|io|dev)|\()/g;

function* walk(dir) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (SKIP_PATHS.some(s => p === s || p.startsWith(s + sep))) continue;
        const st = statSync(p);
        if (st.isDirectory()) yield* walk(p);
        else if (EXTS.has(p.slice(p.lastIndexOf(".")))) yield p;
    }
}

let files = 0, changes = 0;
for (const file of walk(ROOT)) {
    const src = readFileSync(file, "utf8");
    const nl = src.includes("\r\n") ? "\r\n" : "\n";
    let changed = false;
    const out = src.split(nl).map(line => {
        if (SKIP_LINE.some(r => r.test(line))) return line;
        const next = line.replace(OCCURRENCE, () => NAME);
        if (next !== line) { changed = true; changes++; }
        return next;
    }).join(nl);
    if (changed) { writeFileSync(file, out); files++; }
}
// Folder names on disk (%APPDATA%\Equicord -> %APPDATA%\G). Plain "G" because "$" is awkward in paths.
function replaceExact(file, from, to) {
    const text = readFileSync(file, "utf8");
    if (!text.includes(from)) throw new Error(`[g-rename] expected text not found in ${file}: ${from}`);
    writeFileSync(file, text.split(from).join(to));
}
replaceExact(join("src", "main", "patcher.ts"), '"..", "Equicord")', '"..", "G")');
replaceExact(join("src", "main", "utils", "constants.ts"), '"..", "EquicordData", suffix)', '"..", "GData", suffix)');
replaceExact(join("src", "main", "utils", "constants.ts"), '"..", "Equicord", suffix)', '"..", "G", suffix)');

// Logo: replace every use of the Equicord logo with the G logo (embedded PNG, so no hosting needed).
const G_LOGO = "data:image/png;base64,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";
const LOGO_URL = "https://equicord.org/assets/favicon.png";
function* walkAll(dir) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) yield* walkAll(p);
        else yield p;
    }
}
let logos = 0;
for (const file of [...walkAll("src")].filter(f => /\.(tsx?|html|css)$/.test(f))) {
    const text = readFileSync(file, "utf8");
    if (!text.includes(LOGO_URL)) continue;
    logos += text.split(LOGO_URL).length - 1;
    writeFileSync(file, text.split(LOGO_URL).join(G_LOGO));
}
if (logos === 0) throw new Error("[g-rename] logo url not found");
console.log(`[g-rename] replaced ${logos} logo references`);

console.log(`[g-rename] renamed ${changes} occurrence-lines in ${files} files`);
