import { execSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

if (process.platform !== "darwin")
    process.exit(0);

const APP_NAME = "VoidScribe Code";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plistPath = join(root, "node_modules/electron/dist/Electron.app/Contents/Info.plist");

if (!existsSync(plistPath))
    process.exit(0);

for (const key of ["CFBundleName", "CFBundleDisplayName"]) {
    execSync(`plutil -replace ${key} -string ${JSON.stringify(APP_NAME)} ${JSON.stringify(plistPath)}`, {
        stdio: "ignore",
    });
}
