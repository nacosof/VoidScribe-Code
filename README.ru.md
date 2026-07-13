# VoidScribe Code

<p align="center">
  <img src="public/icon.png" alt="VoidScribe Code" width="220" />
</p>

<p align="center">
  <a href="docs/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/status-work%20in%20progress-orange" alt="Status: WIP" />
</p>

<p align="center"><strong>Бесплатная open-source IDE</strong> с поддержкой интеграции API нейросетей.</p>

> **В разработке.** Установщиков `.exe` / `.dmg` пока нет — запуск из исходников.

[English version](README.md)

---

## Что есть в приложении

- Проводник файлов и редактор с вкладками
- Встроенный терминал
- Два режима окна: полноценная IDE или фокус на чате
- **Чат** — диалог с моделью (без инструментов для файлов)
- **Агент** — правки в проекте, команды в shell, MCP
- AI работает только после добавления провайдера и API-ключа (или локального сервера) в **Настройки → Добавить агента**

---

## AI-провайдеры

| Провайдер | Тип | Примечание |
|-----------|-----|------------|
| OpenAI | Облако | API key |
| Anthropic | Облако | API key |
| OpenRouter | Облако | API key |
| Mistral | Облако | API key |
| Groq | Облако | API key |
| Cerebras | Облако | API key |
| Gemini | Облако | API key |
| GenAPI | Облако | API key |
| OpenAI Compatible | Свой endpoint | Base URL + API key |
| Ollama | Локально | `http://127.0.0.1:11434/v1` |
| LM Studio | Локально | `http://127.0.0.1:1234/v1` |

Не все провайдеры и модели проверены вручную. Если что-то не работает — будем исправлять по мере разработки проекта.

---

## Запуск из исходников

**Нужно:** Node.js 18+, npm, Git. На macOS: `xcode-select --install`

```bash
git clone https://github.com/nacosof/VoidScribe-Code.git
cd VoidScribe-Code
npm install
npx electron install
npm run dev
```

```bash
npm run build
npm run preview
```

---

## Документация

- [docs/ARCHITECTURE.ru.md](docs/ARCHITECTURE.ru.md) — архитектура
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architecture (EN)

---

Issues и pull requests приветствуются.
