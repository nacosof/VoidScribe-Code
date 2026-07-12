# Welcome to VoidScribe Code

<p align="center">
  <img src="public/icon.png" alt="VoidScribe Code" width="220" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/status-work%20in%20progress-orange" alt="Status: WIP" />
</p>

<p align="center"><strong>Open-source desktop IDE</strong> with an integrated AI chat and coding agent for local projects.</p>

> **Work in progress.** The project is under active development. Features, UI, and behavior may change. Pre-built installers (`.exe`, `.dmg`) are not available yet — run from source for now.

[Русская версия](README.ru.md)

---

## What is VoidScribe Code?

VoidScribe Code is a **free, open-source IDE** for working with code on your machine:

- File explorer and multi-tab editor (CodeMirror 6)
- Integrated terminal
- AI **Chat** mode — ask questions without touching the workspace
- AI **Agent** mode — reads, edits, creates, and deletes files; runs shell commands in your project
- Bring your own API key or use local models (Ollama, LM Studio)
- Optional MCP tool integration in agent mode

The app is built with Electron and keeps filesystem and shell access in the main process; the UI runs in an isolated renderer.

---

## AI providers

Connect any supported provider in **Settings → Add agent**. You need an API key for cloud providers (stored locally on your machine).

| Provider | Type | Notes |
|----------|------|--------|
| OpenAI | Cloud | API key |
| Anthropic | Cloud | API key |
| OpenRouter | Cloud | API key |
| Mistral | Cloud | API key |
| Groq | Cloud | API key |
| Cerebras | Cloud | API key |
| Gemini | Cloud | API key |
| GenAPI | Cloud | API key |
| OpenAI Compatible | Custom endpoint | Base URL + API key |
| Ollama | Local | Default: `http://127.0.0.1:11434/v1` |
| LM Studio | Local | Default: `http://127.0.0.1:1234/v1` |

**Disclaimer:** Provider integrations are implemented against public APIs and common compatibility layers. **Not every provider and model has been fully tested** — behavior may differ (tool calling, streaming, vision, context limits). If something fails, try another model or provider; broken integrations will also be fixed when possible.

---

## Requirements

- **Node.js** 18 or newer
- **npm** (comes with Node.js)
- **Git**
- **macOS:** Xcode Command Line Tools may be required for the native terminal module (`node-pty`): `xcode-select --install`

---

## Getting started

```bash
git clone https://github.com/nacosof/VoidScribe-Code.git
cd VoidScribe-Code
npm install
npm run dev
```

Other scripts:

```bash
npm run build    # typecheck + production build → out/
npm run preview  # preview production build
```

On first launch, open a project folder (workspace). For agent mode, a workspace is required.

---

## Tech stack

| Layer | Technologies |
|-------|----------------|
| Desktop | Electron |
| Build | electron-vite, Vite, TypeScript |
| UI | React |
| Editor | CodeMirror 6 |
| Terminal | xterm.js, node-pty |
| AI | OpenAI SDK, Anthropic API, provider-specific clients |
| MCP | `@modelcontextprotocol/sdk` |
| Storage | electron-store |

---

## Project layout (short)

```
electron/main/     Main process: IPC, workspace, terminal, AI agent
electron/preload/  Secure bridge → window.voidscribe
src/               React UI, features, editor
ARCHITECTURE.md       Architecture overview (EN)
ARCHITECTURE.ru.md    Архитектура (RU)
```

---

## License

This project is **free and open source** under the [MIT License](LICENSE).  
Russian summary: [LICENSE.ru.md](LICENSE.ru.md)

Use, modify, and distribute freely. No warranty.

---

## Contributing

Issues and pull requests are welcome. Please keep in mind the project is still evolving.
