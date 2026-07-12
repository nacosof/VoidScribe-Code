export type ProjectEntryLayout = {
    nextJsAppDir: "src/app" | "app" | "pages" | null;
    hasDuplicateRootApp: boolean;
};
export declare function detectProjectEntryLayout(workspaceRoot: string): Promise<ProjectEntryLayout>;
export declare function projectEntryLayoutHints(layout: ProjectEntryLayout): string[];
export declare const SCAFFOLD_NUDGE_NEUTRAL = "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0439 \u0437\u0430\u0434\u0430\u0447\u0443 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430\u043C\u0438. Scaffold \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0435\u0441\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u044F\u0432\u043D\u043E \u043F\u0440\u043E\u0441\u0438\u043B \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442.";
export declare function bootstrapWithoutUserRequestMessage(): string;
export declare function wrongNextJsWritePath(layout: ProjectEntryLayout, relativePath: string): string | null;
export declare const BOOTSTRAP_FILE_RE: RegExp;
export type ScaffoldHint = {
    stack: string;
    command: string;
};
export declare function userWantsJavaScriptNotTypeScript(userIntent: string): boolean;
export declare function userWantsNodeJs(userIntent: string): boolean;
export declare function userExplicitlyWantsTypeScript(userIntent: string): boolean;
export declare function isCasualUserMessage(userIntent: string): boolean;
export declare function userExplicitlyRequestedScaffold(userIntent: string): boolean;
export declare function userWantsBootstrapScaffold(userIntent: string): boolean;
export declare function userExplicitlyWantsNext(userIntent: string): boolean;
export declare function inferScaffoldHints(userIntent: string): ScaffoldHint[];
export declare function hasMatureProjectAt(workspaceRoot: string, relativeCwd?: string): Promise<boolean>;
export declare function isBootstrapArtifactPath(relativePath: string): boolean;
export declare const SCAFFOLD_PRIORITY_HINT = "\u041D\u0435\u0437\u0440\u0435\u043B\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442: scaffold (create-vite \u0438 \u0442.\u0434.) \u2014 \u0422\u041E\u041B\u042C\u041A\u041E \u0435\u0441\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u044F\u0432\u043D\u043E \u043F\u0440\u043E\u0441\u0438\u043B \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442/\u043B\u0435\u043D\u0434\u0438\u043D\u0433. \u0418\u043D\u0430\u0447\u0435 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0439 run_command scaffold.";
export declare function manualBootstrapWriteBlockedMessage(hints?: ScaffoldHint[]): string;
