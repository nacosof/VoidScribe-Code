import { chmodSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

if (process.platform !== "darwin")
    process.exit(0);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const prebuilds = join(root, "node_modules", "node-pty", "prebuilds");

for (const arch of ["darwin-arm64", "darwin-x64"]) {
    const helper = join(prebuilds, arch, "spawn-helper");
    if (!existsSync(helper))
        continue;
    chmodSync(helper, 0o755);
}
