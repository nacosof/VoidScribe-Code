/// <reference types="vite/client" />

declare module "rainbowbrackets" {
    import type { Extension } from "@codemirror/state";
    export default function rainbowBrackets(): Extension[];
}
