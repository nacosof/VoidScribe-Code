import { execSync } from "child_process";
import { existsSync, renameSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

if (process.platform !== "darwin")
    process.exit(0);

const APP_NAME = "VoidScribe Code";
const BRANDED_APP = "VoidScribe Code.app";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "node_modules/electron/dist");
const stockApp = join(distDir, "Electron.app");
const brandedApp = join(distDir, BRANDED_APP);
const pathTxt = join(root, "node_modules/electron/path.txt");
const execRelPath = `${BRANDED_APP}/Contents/MacOS/Electron`;

if (!existsSync(distDir))
    process.exit(0);

if (existsSync(stockApp)) {
    if (existsSync(brandedApp)) {
        rmSync(brandedApp, { recursive: true, force: true });
    }
    renameSync(stockApp, brandedApp);
}

const plistPath = join(brandedApp, "Contents/Info.plist");
if (!existsSync(plistPath))
    process.exit(0);

for (const key of ["CFBundleName", "CFBundleDisplayName"]) {
    execSync(`plutil -replace ${key} -string ${JSON.stringify(APP_NAME)} ${JSON.stringify(plistPath)}`, {
        stdio: "ignore",
    });
}

try {
    execSync(`codesign --force --deep --sign - ${JSON.stringify(brandedApp)}`, {
        stdio: "ignore",
    });
}
catch {
}

writeFileSync(pathTxt, execRelPath);
