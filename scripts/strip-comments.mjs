import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "..");
const TARGET_DIRS = ["src", "electron"];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function stripComments(source, filePath) {
  const kind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    kind
  );
  const printer = ts.createPrinter({ removeComments: true });
  let text = printer.printFile(sourceFile);
  if (!text.endsWith("\n")) text += "\n";
  return text;
}

let changed = 0;
for (const rel of TARGET_DIRS) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const before = fs.readFileSync(file, "utf8");
    const after = stripComments(before, file);
    if (after !== before) {
      fs.writeFileSync(file, after, "utf8");
      changed += 1;
      console.log(`stripped: ${path.relative(ROOT, file)}`);
    }
  }
}

const cssPath = path.join(ROOT, "src", "index.css");
if (fs.existsSync(cssPath)) {
  const before = fs.readFileSync(cssPath, "utf8");
  const after = before.replace(/\/\*[\s\S]*?\*\//g, "");
  if (after !== before) {
    fs.writeFileSync(cssPath, after, "utf8");
    changed += 1;
    console.log("stripped: src/index.css");
  }
}

console.log(`done: ${changed} file(s) updated`);
