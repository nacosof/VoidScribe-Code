import { existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const candidates = [
    join(process.env.APPDATA ?? "", "voidscribe-code", "config.json"),
    join(homedir(), "Library", "Application Support", "voidscribe-code", "config.json"),
    join(homedir(), ".config", "voidscribe-code", "config.json"),
];

let updated = false;

for (const path of candidates) {
    if (!existsSync(path))
        continue;
    const data = JSON.parse(readFileSync(path, "utf8"));
    data.onboardingCompleted = false;
    data.workspacePath = "";
    data.recentWorkspaces = [];
    if (data.settings && typeof data.settings === "object") {
        data.settings.language = "en";
    }
    writeFileSync(path, `${JSON.stringify(data, null, "\t")}\n`, "utf8");
    console.log(`Onboarding reset: ${path}`);
    updated = true;
    break;
}

if (!updated) {
    console.log("Store file not found. First launch will show onboarding automatically.");
}
