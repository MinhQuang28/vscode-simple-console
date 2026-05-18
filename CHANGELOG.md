# Changelog

## [0.1.0] - 2026-05-18

### Added
- Insert smart `console.log` with enclosing function/class context (`Cmd+Shift+L`)
- AST-based context detection via VS Code language server
- Multi-cursor support — insert multiple logs at once
- Multi-line statement awareness (handles `if (...)`, multi-line `const`, function args)
- Skip duplicate logs on same variable
- Comment all logs (`Cmd+Shift+,`)
- Uncomment all logs (`Cmd+Shift+U`)
- Remove all logs (`Cmd+Shift+Alt+L`)
- Status bar counter with click-to-clear
- Settings: emoji, semicolon, quote style
