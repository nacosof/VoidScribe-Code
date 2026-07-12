# Добро пожаловать в VoidScribe Code

<p align="center">
  <img src="public/icon.png" alt="VoidScribe Code" width="220" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/status-work%20in%20progress-orange" alt="Status: WIP" />
</p>

<p align="center"><strong>Desktop open-source IDE</strong> с встроенным AI-чатом и агентом для локальных проектов.</p>

> **В разработке.** Проект активно развивается. Функции, интерфейс и поведение могут меняться. Готовых установщиков (`.exe`, `.dmg`) пока нет — запускайте из исходников.

[English version](README.md)

---

## Что такое VoidScribe Code?

VoidScribe Code — **free open-source IDE** для работы с кодом на вашем компьютере:

- Проводник файлов и редактор с вкладками (CodeMirror 6)
- Встроенный терминал
- Режим **Чат** — вопросы к модели без изменения проекта
- Режим **Агент** — читает, создаёт, изменяет и удаляет файлы; запускает команды в shell
- Свой API-ключ или локальные модели (Ollama, LM Studio)
- Опциональная интеграция MCP-инструментов в режиме агента

Приложение на Electron: доступ к файлам и терминалу — в main process, интерфейс — в изолированном renderer.

---

## AI-провайдеры

Подключение в **Настройки → Добавить агента**. Для облачных провайдеров нужен API-ключ (хранится локально на вашем ПК).

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
| Ollama | Локально | По умолчанию: `http://127.0.0.1:11434/v1` |
| LM Studio | Локально | По умолчанию: `http://127.0.0.1:1234/v1` |

**Важно:** интеграции сделаны по публичным API и совместимым протоколам. **Не все провайдеры и модели проверены вручную** — возможны отличия (tool calling, стриминг, vision, лимиты контекста). Если что-то не работает, попробуйте другую модель или провайдера; также неработающие интеграции будут исправляться по мере возможности.

---

## Требования

- **Node.js** 18 или новее
- **npm** (идёт с Node.js)
- **Git**
- **macOS:** для нативного терминала (`node-pty`) могут понадобиться Xcode Command Line Tools: `xcode-select --install`

---

## Запуск

```bash
git clone https://github.com/nacosof/VoidScribe-Code.git
cd VoidScribe-Code
npm install
npm run dev
```

Другие команды:

```bash
npm run build    # проверка типов + сборка → out/
npm run preview  # предпросмотр production-сборки
```

При первом запуске откройте папку проекта (workspace). Для режима агента workspace обязателен.

---

## Стек

| Слой | Технологии |
|------|------------|
| Desktop | Electron |
| Сборка | electron-vite, Vite, TypeScript |
| UI | React |
| Редактор | CodeMirror 6 |
| Терминал | xterm.js, node-pty |
| AI | OpenAI SDK, Anthropic API, клиенты провайдеров |
| MCP | `@modelcontextprotocol/sdk` |
| Хранение настроек | electron-store |

---

## Структура (кратко)

```
electron/main/     Main process: IPC, workspace, терминал, AI-агент
electron/preload/  Безопасный мост → window.voidscribe
src/               React UI, features, редактор
ARCHITECTURE.md       Обзор архитектуры (EN)
ARCHITECTURE.ru.md    Подробная архитектура (RU)
```

---

## Лицензия

Проект **полностью бесплатный и open source** — [MIT License](LICENSE).  
Пояснение на русском: [LICENSE.ru.md](LICENSE.ru.md)

Можно использовать, изменять и распространять без ограничений. Без гарантий.

---

## Участие

Issues и pull requests приветствуются. Учитывайте, что проект ещё в активной разработке.
