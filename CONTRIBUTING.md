# Contributing to Skill Switch

Thank you for your interest in contributing! This project is currently maintained as a personal/small-team tool, but feedback and pull requests are welcome.

## Getting Started

1. Fork the repository and clone it locally.
2. Run `npm install` to install dependencies.
3. Open the project in VS Code.
4. Press `F5` to launch the Extension Development Host.

## Project Structure

```
src/
├── commands/         # Command handlers
├── i18n/             # Localization (en / zh)
├── services/         # Core business logic (state, profiles, sync)
├── tree/             # Tree view data provider
├── utils/            # File utilities
├── webview/          # Settings webview panel
├── extension.ts      # Entry point
└── types.ts          # Shared TypeScript types
```

## Submitting Changes

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes and ensure the code compiles: `npm run compile`
3. Commit with a clear message.
4. Open a Pull Request describing what you changed and why.

## Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub with:
- A clear description of the problem or idea
- Steps to reproduce (for bugs)
- Your VS Code version and OS
