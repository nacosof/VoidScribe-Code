#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_TRANSCRIPT_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".cursor",
  "projects",
  "d-frontend-developed-React-VoidScribe-exe-dmg",
  "agent-transcripts",
  "eceea267-8a3b-45ef-95ee-b2aa47da46bb"
);

const CRITICAL_FILES = [
  "package.json",
  "src/App.tsx",
  "electron/main/index.ts",
  "electron/main/agent-tools.ts",
  "electron/main/ai.ts",
  "electron/main/workspace.ts",
  "electron/preload/index.ts",
  "electron/main/types.ts",
  "src/types.ts",
];

const PROJECT_MARKER = /VoidScribe_exe-dmg/i;

function normalizeRel(absPath) {
  const norm = absPath.replace(/\\/g, "/");
  const m = norm.match(/VoidScribe_exe-dmg[/](.+)$/i);
  if (!m) return null;
  return m[1];
}

function applyStrReplace(content, oldString, newString, replaceAll) {
  if (oldString === "") {
    return { ok: true, content: newString };
  }
  if (!content.includes(oldString)) {
    return { ok: false, content, reason: "old_string not found" };
  }
  if (replaceAll) {
    return { ok: true, content: content.split(oldString).join(newString) };
  }
  const idx = content.indexOf(oldString);
  return {
    ok: true,
    content: content.slice(0, idx) + newString + content.slice(idx + oldString.length),
  };
}

function collectTranscriptFiles(transcriptDir) {
  const main = path.join(transcriptDir, path.basename(transcriptDir) + ".jsonl");
  const files = [];
  if (fs.existsSync(main)) files.push(main);
  const subDir = path.join(transcriptDir, "subagents");
  if (fs.existsSync(subDir)) {
    for (const name of fs.readdirSync(subDir).filter((f) => f.endsWith(".jsonl")).sort()) {
      files.push(path.join(subDir, name));
    }
  }
  return files;
}

function* iterToolEvents(transcriptFiles) {
  let seq = 0;
  for (const file of transcriptFiles) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      let record;
      try {
        record = JSON.parse(lines[lineIdx]);
      } catch {
        continue;
      }
      const content = record.message?.content;
      if (!Array.isArray(content)) continue;
      for (let toolIdx = 0; toolIdx < content.length; toolIdx++) {
        const part = content[toolIdx];
        if (part?.type !== "tool_use") continue;
        if (part.name !== "Write" && part.name !== "StrReplace") continue;
        const input = part.input || {};
        const absPath = input.path;
        if (!absPath || !PROJECT_MARKER.test(absPath)) continue;
        const rel = normalizeRel(absPath);
        if (!rel) continue;
        seq += 1;
        yield {
          seq,
          source: path.basename(file),
          lineIdx,
          toolIdx,
          kind: part.name,
          rel,
          input,
        };
      }
    }
  }
}

function extractPackageJsonSnippets(events, rawTranscriptText) {
  const snippets = [];

  for (const ev of events) {
    if (ev.rel === "package.json" && ev.kind === "Write" && ev.input.contents) {
      snippets.push({ type: "Write", seq: ev.seq, text: ev.input.contents });
    }
    if (ev.rel === "package.json" && ev.kind === "StrReplace") {
      snippets.push({
        type: "StrReplace",
        seq: ev.seq,
        old_string: ev.input.old_string,
        new_string: ev.input.new_string,
      });
    }
    if (ev.kind === "StrReplace") {
      const blob = (ev.input.old_string || "") + (ev.input.new_string || "");
      if (/package\.json/i.test(ev.rel) || /"dependencies"\s*:/.test(blob)) {
        snippets.push({
          type: "StrReplace-deps",
          seq: ev.seq,
          path: ev.rel,
          old_string: ev.input.old_string,
          new_string: ev.input.new_string,
        });
      }
    }
  }

  const jsonBlockRe = /\{[^{}]*"name"\s*:[^{}]*"dependencies"\s*:\s*\{[\s\S]*?\}[\s\S]*?\}/g;
  let m;
  while ((m = jsonBlockRe.exec(rawTranscriptText)) !== null) {
    snippets.push({ type: "raw-json-block", text: m[0].slice(0, 8000) });
  }

  return snippets;
}

function main() {
  const transcriptDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_TRANSCRIPT_DIR;

  if (!fs.existsSync(transcriptDir)) {
    console.error("Transcript directory not found:", transcriptDir);
    process.exit(1);
  }

  const transcriptFiles = collectTranscriptFiles(transcriptDir);
  const events = [...iterToolEvents(transcriptFiles)];

  const files = new Map();

  for (const ev of events) {
    if (!files.has(ev.rel)) {
      files.set(ev.rel, { content: null, hadWrite: false, replaces: 0, failed: 0 });
    }
    const st = files.get(ev.rel);

    if (ev.kind === "Write") {
      st.content = ev.input.contents ?? "";
      st.hadWrite = true;
      continue;
    }

    st.replaces += 1;
    if (st.content === null) {
      st.failed += 1;
      continue;
    }

    const result = applyStrReplace(
      st.content,
      ev.input.old_string ?? "",
      ev.input.new_string ?? "",
      Boolean(ev.input.replace_all)
    );
    if (result.ok) {
      st.content = result.content;
    } else {
      st.failed += 1;
    }
  }

  const needsBase = [];
  const written = [];
  const skippedFailed = [];

  for (const [rel, st] of files.entries()) {
    if (!st.hadWrite) {
      if (st.replaces > 0) needsBase.push(rel);
      continue;
    }
    if (st.content === null) continue;

    const outPath = path.join(PROJECT_ROOT, rel.split("/").join(path.sep));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, st.content, "utf8");
    written.push({ rel, failed: st.failed, replaces: st.replaces });
    if (st.failed > 0) skippedFailed.push({ rel, failed: st.failed });
  }

  const rawText = transcriptFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const pkgSnippets = extractPackageJsonSnippets(events, rawText);

  console.log("=== Restore from transcript ===");
  console.log("Transcript:", transcriptDir);
  console.log("Sources:", transcriptFiles.map((f) => path.basename(f)).join(", "));
  console.log("Events:", events.length);
  console.log("Files written:", written.length);
  console.log("");

  console.log("=== Critical files status ===");
  for (const crit of CRITICAL_FILES) {
    const st = files.get(crit);
    let status;
    if (!st) status = "no operations in transcript";
    else if (!st.hadWrite) status = "NEEDS BASE (StrReplace only)";
    else if (written.some((w) => w.rel === crit)) status = "restored";
    else status = "had Write but not written";
    console.log("  " + crit + ": " + status);
  }
  console.log("");

  console.log("=== Needs manual reconstruction (StrReplace without Write) ===");
  console.log("Count:", needsBase.length);
  for (const rel of needsBase.sort()) {
    console.log("  " + rel);
  }
  console.log("");

  if (skippedFailed.length) {
    console.log("=== Restored with failed StrReplace steps ===");
    for (const { rel, failed } of skippedFailed.sort((a, b) => a.rel.localeCompare(b.rel))) {
      console.log("  " + rel + ": " + failed + " failed replace(s)");
    }
    console.log("");
  }

  console.log("=== package.json content found in transcript ===");
  if (!pkgSnippets.length) {
    console.log("  (none from Write or dependency StrReplace blocks)");
  } else {
    for (const sn of pkgSnippets) {
      console.log("---", sn.type, sn.seq ?? "", sn.path ?? "");
      if (sn.text) console.log(sn.text.slice(0, 4000));
      if (sn.old_string !== undefined) {
        console.log("old:", (sn.old_string || "").slice(0, 1500));
        console.log("new:", (sn.new_string || "").slice(0, 1500));
      }
    }
  }

  console.log("");
  console.log("=== Written files ===");
  for (const { rel } of written.sort((a, b) => a.rel.localeCompare(b.rel))) {
    console.log("  " + rel);
  }
}

main();
