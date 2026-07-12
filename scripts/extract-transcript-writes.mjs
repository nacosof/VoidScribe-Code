import fs from "fs";
import path from "path";

const transcript = process.argv[2];
const outDir = process.argv[3];
if (!transcript || !outDir) {
  console.error("Usage: node extract-transcript-writes.mjs <transcript.jsonl> <outDir>");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const lines = fs.readFileSync(transcript, "utf8").split(/\n/).filter(Boolean);
const map = new Map();

for (const line of lines) {
  let o;
  try {
    o = JSON.parse(line);
  } catch {
    continue;
  }
  for (const item of o.message?.content ?? []) {
    if (item.type !== "tool_use" || item.name !== "Write") continue;
    const p = String(item.input?.path ?? "").replace(/\\/g, "/");
    const m = p.match(/VoidScribe_exe-dmg\/(.+)$/);
    if (!m) continue;
    map.set(m[1], item.input.contents);
  }
}

for (const [rel, content] of map) {
  const dest = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
}

console.log(`extracted ${map.size} files to ${outDir}`);
