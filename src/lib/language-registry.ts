export type LintStrategy = "python" | "json" | "javascript" | "css" | "html" | "yaml" | "toml" | "rust" | "c" | "cpp" | "java" | "csharp" | "dart" | "go" | "php" | "ruby" | "lua" | "kotlin" | "swift" | "scala" | "shell" | "perl" | "zig" | "r" | "sql" | "dockerfile" | "graphql" | "haskell" | "elixir" | "clojure" | "fsharp" | "objectivec" | "powershell" | "vue";
export type HighlightMode = "javascript" | "typescript" | "jsx" | "tsx" | "json" | "css" | "html" | "markdown" | "python" | "rust" | "cpp" | "java" | "csharp" | "sql" | "yaml" | "dart" | "go" | "php" | "ruby" | "kotlin" | "swift" | "lua" | "scala" | "shell" | "perl" | "zig" | "r" | "dockerfile" | "graphql" | "toml" | "haskell" | "clojure" | "erlang" | "elixir" | "fsharp" | "objectivec" | "powershell" | "vue" | "svelte" | "plaintext";
export type LanguageSpec = {
    lint: LintStrategy | null;
    highlight: HighlightMode;
};
export const LANGUAGE_BY_EXTENSION: Record<string, LanguageSpec> = {
    js: { lint: "javascript", highlight: "javascript" },
    mjs: { lint: "javascript", highlight: "javascript" },
    cjs: { lint: "javascript", highlight: "javascript" },
    jsx: { lint: "javascript", highlight: "jsx" },
    ts: { lint: "javascript", highlight: "typescript" },
    mts: { lint: "javascript", highlight: "typescript" },
    cts: { lint: "javascript", highlight: "typescript" },
    tsx: { lint: "javascript", highlight: "tsx" },
    vue: { lint: "vue", highlight: "vue" },
    svelte: { lint: null, highlight: "svelte" },
    json: { lint: "json", highlight: "json" },
    jsonc: { lint: "json", highlight: "json" },
    json5: { lint: "json", highlight: "json" },
    yaml: { lint: "yaml", highlight: "yaml" },
    yml: { lint: "yaml", highlight: "yaml" },
    toml: { lint: "toml", highlight: "toml" },
    xml: { lint: "html", highlight: "html" },
    svg: { lint: "html", highlight: "html" },
    html: { lint: "html", highlight: "html" },
    htm: { lint: "html", highlight: "html" },
    xhtml: { lint: "html", highlight: "html" },
    css: { lint: "css", highlight: "css" },
    scss: { lint: "css", highlight: "css" },
    less: { lint: "css", highlight: "css" },
    sass: { lint: "css", highlight: "css" },
    graphql: { lint: "graphql", highlight: "graphql" },
    gql: { lint: "graphql", highlight: "graphql" },
    py: { lint: "python", highlight: "python" },
    pyw: { lint: "python", highlight: "python" },
    pyi: { lint: "python", highlight: "python" },
    rs: { lint: "rust", highlight: "rust" },
    c: { lint: "c", highlight: "cpp" },
    h: { lint: "cpp", highlight: "cpp" },
    cc: { lint: "cpp", highlight: "cpp" },
    cpp: { lint: "cpp", highlight: "cpp" },
    cxx: { lint: "cpp", highlight: "cpp" },
    hpp: { lint: "cpp", highlight: "cpp" },
    hh: { lint: "cpp", highlight: "cpp" },
    hxx: { lint: "cpp", highlight: "cpp" },
    zig: { lint: "zig", highlight: "zig" },
    go: { lint: "go", highlight: "go" },
    mod: { lint: null, highlight: "go" },
    sum: { lint: null, highlight: "plaintext" },
    java: { lint: "java", highlight: "java" },
    kt: { lint: "kotlin", highlight: "kotlin" },
    kts: { lint: "kotlin", highlight: "kotlin" },
    scala: { lint: "scala", highlight: "scala" },
    sc: { lint: "scala", highlight: "scala" },
    cs: { lint: "csharp", highlight: "csharp" },
    fs: { lint: "fsharp", highlight: "fsharp" },
    fsx: { lint: "fsharp", highlight: "fsharp" },
    vb: { lint: "csharp", highlight: "csharp" },
    swift: { lint: "swift", highlight: "swift" },
    m: { lint: "objectivec", highlight: "objectivec" },
    mm: { lint: "objectivec", highlight: "objectivec" },
    dart: { lint: "dart", highlight: "dart" },
    php: { lint: "php", highlight: "php" },
    rb: { lint: "ruby", highlight: "ruby" },
    erb: { lint: "ruby", highlight: "ruby" },
    lua: { lint: "lua", highlight: "lua" },
    pl: { lint: "perl", highlight: "perl" },
    pm: { lint: "perl", highlight: "perl" },
    r: { lint: "r", highlight: "r" },
    R: { lint: "r", highlight: "r" },
    sh: { lint: "shell", highlight: "shell" },
    bash: { lint: "shell", highlight: "shell" },
    zsh: { lint: "shell", highlight: "shell" },
    fish: { lint: "shell", highlight: "shell" },
    ps1: { lint: "powershell", highlight: "powershell" },
    psm1: { lint: "powershell", highlight: "powershell" },
    hs: { lint: "haskell", highlight: "haskell" },
    lhs: { lint: "haskell", highlight: "haskell" },
    ex: { lint: "elixir", highlight: "elixir" },
    exs: { lint: "elixir", highlight: "elixir" },
    erl: { lint: null, highlight: "erlang" },
    hrl: { lint: null, highlight: "erlang" },
    clj: { lint: null, highlight: "clojure" },
    cljs: { lint: null, highlight: "clojure" },
    edn: { lint: null, highlight: "clojure" },
    sql: { lint: "sql", highlight: "sql" },
    mysql: { lint: "sql", highlight: "sql" },
    pgsql: { lint: "sql", highlight: "sql" },
    psql: { lint: "sql", highlight: "sql" },
    md: { lint: null, highlight: "markdown" },
    mdx: { lint: null, highlight: "markdown" },
    markdown: { lint: null, highlight: "markdown" },
    dockerfile: { lint: "dockerfile", highlight: "dockerfile" },
    containerfile: { lint: "dockerfile", highlight: "dockerfile" },
    env: { lint: null, highlight: "plaintext" },
    ini: { lint: null, highlight: "plaintext" },
    cfg: { lint: null, highlight: "plaintext" },
    conf: { lint: null, highlight: "plaintext" },
    properties: { lint: null, highlight: "plaintext" },
    gitignore: { lint: null, highlight: "plaintext" },
    dockerignore: { lint: null, highlight: "plaintext" },
    lock: { lint: null, highlight: "plaintext" },
    log: { lint: null, highlight: "plaintext" },
    txt: { lint: null, highlight: "plaintext" },
};
export function getLanguageSpec(filePath: string): LanguageSpec | null {
    const base = filePath.replace(/\\/g, "/").split("/").pop() ?? filePath;
    const lower = base.toLowerCase();
    if (lower === "dockerfile" || lower.startsWith("dockerfile.")) {
        return LANGUAGE_BY_EXTENSION.dockerfile ?? null;
    }
    if (lower === "makefile" || lower === "gnumakefile") {
        return { lint: null, highlight: "shell" };
    }
    if (lower === "cmakelists.txt") {
        return { lint: null, highlight: "plaintext" };
    }
    if (lower.startsWith(".env")) {
        return { lint: null, highlight: "plaintext" };
    }
    const ext = lower.includes(".") ? lower.split(".").pop()! : lower;
    return LANGUAGE_BY_EXTENSION[ext] ?? null;
}
export function getLintStrategy(filePath: string): LintStrategy | null {
    return getLanguageSpec(filePath)?.lint ?? null;
}
export function getHighlightMode(filePath: string): HighlightMode {
    return getLanguageSpec(filePath)?.highlight ?? "plaintext";
}
export const SUPPORTED_LINT_EXTENSIONS = Object.entries(LANGUAGE_BY_EXTENSION)
    .filter(([, spec]) => spec.lint !== null)
    .map(([ext]) => ext)
    .sort();
