import { basename } from "path";
import { writeWorkspaceFile, readWorkspaceFileIfExists } from "./workspace";
import { runWorkspaceCommand } from "./terminal";
import { WorkspaceError } from "./workspace";

export type ScaffoldFileEvent = {
  path: string;
  kind: "created" | "modified";
  previousContent: string | null;
  newContent: string;
};

export function npmPackageNameFromFolder(folderName: string): string {
  const normalized = folderName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return normalized || "app";
}

async function writeScaffoldFile(
  workspaceRoot: string,
  path: string,
  content: string,
  onFile?: (event: ScaffoldFileEvent) => void
): Promise<void> {
  const previousContent = await readWorkspaceFileIfExists(workspaceRoot, path);
  const kind: "created" | "modified" =
    previousContent === null ? "created" : "modified";
  await writeWorkspaceFile(workspaceRoot, path, content, {
    historySource: "agent",
  });
  onFile?.({ path, kind, previousContent, newContent: content });
}

export async function scaffoldNextApp(input: {
  workspaceRoot: string;
  displayName?: string;
  onFile?: (event: ScaffoldFileEvent) => void;
}): Promise<string> {
  const { workspaceRoot, onFile } = input;
  const folderName = basename(workspaceRoot);
  const packageName = npmPackageNameFromFolder(folderName);
  const displayName = input.displayName?.trim() || folderName;

  const existing = await readWorkspaceFileIfExists(workspaceRoot, "package.json");
  if (existing !== null) {
    throw new WorkspaceError(
      "package.json уже есть — используй read_file и правь app/page.tsx. scaffold_next_app вызывай только один раз."
    );
  }

  const packageJson = {
    name: packageName,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
    },
    dependencies: {
      next: "^15.3.3",
      react: "^19.1.0",
      "react-dom": "^19.1.0",
    },
    devDependencies: {
      "@types/node": "^22.15.21",
      "@types/react": "^19.1.6",
      "@types/react-dom": "^19.1.5",
      eslint: "^9.28.0",
      "eslint-config-next": "^15.3.3",
      postcss: "^8.5.4",
      tailwindcss: "^3.4.17",
      typescript: "^5.8.3",
    },
  };

  const files: Array<{ path: string; content: string }> = [
    {
      path: "package.json",
      content: `${JSON.stringify(packageJson, null, 2)}\n`,
    },
    {
      path: "tsconfig.json",
      content:
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2017",
              lib: ["dom", "dom.iterable", "esnext"],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              noEmit: true,
              esModuleInterop: true,
              module: "esnext",
              moduleResolution: "bundler",
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: "preserve",
              incremental: true,
              plugins: [{ name: "next" }],
              paths: { "@/*": ["./*"] },
            },
            include: [
              "next-env.d.ts",
              "**/*.ts",
              "**/*.tsx",
              ".next/types/**/*.ts",
            ],
            exclude: ["node_modules"],
          },
          null,
          2
        ) + "\n",
    },
    {
      path: "next.config.ts",
      content: `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`,
    },
    {
      path: "postcss.config.mjs",
      content: `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
  },
};

export default config;
`,
    },
    {
      path: "tailwind.config.ts",
      content: `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
`,
    },
    {
      path: "next-env.d.ts",
      content: `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`,
    },
    {
      path: "app/globals.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

body {
  margin: 0;
  min-height: 100vh;
  background: #0a0a0a;
  color: #ededed;
}
`,
    },
    {
      path: "app/layout.tsx",
      content: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(displayName)},
  description: ${JSON.stringify(`${displayName} — built with Next.js`)},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
`,
    },
    {
      path: "app/page.tsx",
      content: `export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">{${JSON.stringify(displayName)}}</h1>
      <p className="text-neutral-400">Next.js готов. Можно править app/page.tsx.</p>
    </main>
  );
}
`,
    },
  ];

  for (const file of files) {
    await writeScaffoldFile(workspaceRoot, file.path, file.content, onFile);
  }

  const install = await runWorkspaceCommand(workspaceRoot, "npm install", ".");
  if (install.exitCode !== 0) {
    return [
      `Next.js scaffold создан (package name: ${packageName}, display: ${displayName}).`,
      "npm install завершился с ошибкой:",
      install.stderr || install.stdout,
      "Повтори run_command: npm install",
    ].join("\n");
  }

  return [
    `Next.js scaffold готов в текущей папке.`,
    `package.json name: "${packageName}" (npm lowercase).`,
    `Отображаемое имя: "${displayName}".`,
    "Структура: app/page.tsx (App Router), не pages/.",
    "Запуск: npm run dev → http://localhost:3000",
  ].join("\n");
}

export function workspaceFolderHasUppercase(workspaceRoot: string): boolean {
  return /[A-Z]/.test(basename(workspaceRoot));
}
