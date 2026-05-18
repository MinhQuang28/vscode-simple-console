# Quick Log

Insert smart `console.log` statements with context — instantly, with one keystroke.

```ts
const error = catchSomething();
// Press Cmd+Shift+L on `error` →
console.log("🚀 ~ ErrorBoundary ~ error:", error);
```

## Features

- 🚀 **Smart context detection** — auto-detects enclosing function/class/method name via the language server (AST-accurate for TypeScript / JavaScript / TSX / JSX)
- 📐 **Multi-line statement aware** — handles `if (...)`, multi-line `const x = ...`, function args spanning lines; never breaks syntax
- 🖱️ **Multi-cursor support** — place multiple cursors, insert all logs at once
- 🔁 **Skip duplicates** — pressing the shortcut twice on the same variable does nothing
- 💬 **Comment / Uncomment / Remove** — toggle all logs in the file with one shortcut
- 📊 **Status bar counter** — see at a glance how many 🚀 logs are in the current file; click to wipe them
- ⚙️ **Configurable** — change emoji, quote style, semicolon

## Keybindings

| Shortcut | Action |
|---|---|
| `Cmd+Shift+L` | Insert log for variable under cursor |
| `Cmd+Shift+,` | Comment all 🚀 logs in file |
| `Cmd+Shift+U` | Uncomment all 🚀 logs in file |
| `Cmd+Shift+Alt+L` | Remove all 🚀 logs in file |

> On Windows / Linux, replace `Cmd` with `Ctrl`.

## Settings

| Setting | Default | Description |
|---|---|---|
| `quickLog.emoji` | `🚀` | Emoji prefix in logs |
| `quickLog.semicolon` | `true` | Append `;` at end |
| `quickLog.quote` | `"double"` | `"double"` / `"single"` / `"backtick"` |

## Examples

**Simple variable:**
```ts
function handle(error) {
  error // ← cursor here
}
// →
function handle(error) {
  error
  console.log("🚀 ~ handle ~ error:", error);
}
```

**Multi-line declaration:**
```ts
const originalPrice =
  (price.compareAtPrice * shopifyRate) / Number(price?.rate) -
  data.final_line_price;
console.log("🚀 ~ calcPrice ~ originalPrice:", originalPrice);
```

**Variable inside `if (...)` condition:**
```ts
if (
  price?.compareAtPrice &&
  settings?.customization?.showCompareAtPrice // ← cursor here
) {
  // body
}
console.log("🚀 ~ useEffect ~ settings:", settings);
```

## License

MIT
