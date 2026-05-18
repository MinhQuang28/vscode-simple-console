import * as vscode from 'vscode';

let statusItem: vscode.StatusBarItem;

export function activate(ctx: vscode.ExtensionContext) {
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.command = 'quickLog.removeAll';
  statusItem.tooltip = 'Quick Log: click to remove all 🚀 logs';

  ctx.subscriptions.push(
    statusItem,
    vscode.commands.registerCommand('quickLog.insert', insertLog),
    vscode.commands.registerCommand('quickLog.removeAll', removeAllLogs),
    vscode.commands.registerCommand('quickLog.commentAll', commentAllLogs),
    vscode.commands.registerCommand('quickLog.uncommentAll', uncommentAllLogs),
    vscode.window.onDidChangeActiveTextEditor(updateStatus),
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document === vscode.window.activeTextEditor?.document) scheduleStatus();
    }),
  );
  updateStatus();
}

export function deactivate() {}

const LOG_RE = /^\s*console\.log\(["'`]🚀 ~ .+\);?\s*$/;
const COMMENTED_LOG_RE = /^(\s*)\/\/\s*(console\.log\(["'`]🚀 ~ .+\);?\s*)$/;

let statusTimer: NodeJS.Timeout | undefined;
function scheduleStatus() {
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(updateStatus, 300);
}

function updateStatus() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { statusItem.hide(); return; }
  const doc = editor.document;
  let count = 0;
  for (let i = 0; i < doc.lineCount; i++) {
    const t = doc.lineAt(i).text;
    if (LOG_RE.test(t) || COMMENTED_LOG_RE.test(t)) count++;
  }
  if (count === 0) { statusItem.hide(); return; }
  statusItem.text = `🚀 ${count}`;
  statusItem.show();
}

const SYMBOL_KINDS_FN = new Set<vscode.SymbolKind>([
  vscode.SymbolKind.Function,
  vscode.SymbolKind.Method,
  vscode.SymbolKind.Constructor,
  vscode.SymbolKind.Class,
  vscode.SymbolKind.Variable,
  vscode.SymbolKind.Property,
  vscode.SymbolKind.Field,
]);

function getVarName(doc: vscode.TextDocument, sel: vscode.Selection): string | undefined {
  if (!sel.isEmpty) return doc.getText(sel).trim();
  const range = doc.getWordRangeAtPosition(sel.active, /[\w$.[\]]+/);
  return range ? doc.getText(range) : undefined;
}

function stripCode(text: string): string {
  return text
    .replace(/\/\/.*$/, '')
    .replace(/\/\*.*?\*\//g, '')
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
}

const CONT_RE = /[,+\-*/%=&|?:<>({[\\]$|=>$/;

function findStatementStart(doc: vscode.TextDocument, cursorLine: number): number {
  let depth = 0;
  for (let i = cursorLine; i >= 0; i--) {
    const stripped = stripCode(doc.lineAt(i).text);
    for (let k = stripped.length - 1; k >= 0; k--) {
      const ch = stripped[k];
      if (')]}'.includes(ch)) depth++;
      else if ('([{'.includes(ch)) {
        depth--;
        if (depth < 0) return i;
      }
    }
    if (i > 0 && depth === 0) {
      const prev = stripCode(doc.lineAt(i - 1).text).trimEnd();
      if (/[;{}]$/.test(prev)) return i;
    }
  }
  return 0;
}

function findStatementEndLine(doc: vscode.TextDocument, startLine: number): number {
  let depth = 0;
  for (let i = startLine; i < doc.lineCount; i++) {
    const stripped = stripCode(doc.lineAt(i).text);
    for (const ch of stripped) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
    }
    const trimmed = stripped.trimEnd();
    if (depth <= 0 && trimmed.length > 0 && !CONT_RE.test(trimmed)) return i;
  }
  return startLine;
}

function findInnermostSymbol(symbols: vscode.DocumentSymbol[], pos: vscode.Position): vscode.DocumentSymbol | undefined {
  let best: vscode.DocumentSymbol | undefined;
  const walk = (nodes: vscode.DocumentSymbol[]) => {
    for (const n of nodes) {
      if (n.range.contains(pos)) {
        if (SYMBOL_KINDS_FN.has(n.kind)) best = n;
        if (n.children?.length) walk(n.children);
      }
    }
  };
  walk(symbols);
  return best;
}

async function getContextName(doc: vscode.TextDocument, pos: vscode.Position): Promise<string> {
  try {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      doc.uri,
    );
    if (symbols?.length) {
      const sym = findInnermostSymbol(symbols, pos);
      if (sym) return sym.name.replace(/\(.*\)$/, '').trim() || 'log';
    }
  } catch { /* fallback below */ }
  return findEnclosingNameRegex(doc, pos.line);
}

function findEnclosingNameRegex(doc: vscode.TextDocument, line: number): string {
  const fnRe = /(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>|([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{|class\s+([A-Za-z_$][\w$]*))/;
  for (let i = line; i >= 0; i--) {
    const m = doc.lineAt(i).text.match(fnRe);
    if (m) return m[1] || m[2] || m[3] || m[4] || 'anonymous';
  }
  return 'log';
}

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function insertLog() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;

  const cfg = vscode.workspace.getConfiguration('quickLog');
  const emoji = cfg.get<string>('emoji', '🚀');
  const semi = cfg.get<boolean>('semicolon', true) ? ';' : '';
  const q = cfg.get<string>('quote', 'double');
  const qc = q === 'single' ? "'" : q === 'backtick' ? '`' : '"';

  let symbols: vscode.DocumentSymbol[] = [];
  try {
    symbols = (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider', doc.uri,
    )) ?? [];
  } catch { /* ignore */ }

  type Job = { endLine: number; text: string; varName: string; ctx: string };
  const jobs: Job[] = [];
  const seenKey = new Set<string>();

  for (const sel of editor.selections) {
    const varName = getVarName(doc, sel);
    if (!varName) continue;
    const cursorLine = sel.active.line;
    const stmtStart = findStatementStart(doc, cursorLine);
    const endLine = findStatementEndLine(doc, stmtStart);

    let ctx = 'log';
    if (symbols.length) {
      const sym = findInnermostSymbol(symbols, sel.active);
      if (sym) ctx = sym.name.replace(/\(.*\)$/, '').trim() || 'log';
      else ctx = findEnclosingNameRegex(doc, cursorLine);
    } else {
      ctx = findEnclosingNameRegex(doc, cursorLine);
    }

    const key = `${endLine}:${varName}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);

    const nextLine = endLine + 1 < doc.lineCount ? doc.lineAt(endLine + 1).text : '';
    const dupRe = new RegExp(`console\\.log\\(["'\`]${escapeRe(emoji)} ~ [^~]+ ~ ${escapeRe(varName)}:`);
    if (dupRe.test(nextLine)) continue;

    const indent = doc.lineAt(stmtStart).text.match(/^\s*/)?.[0] ?? '';
    const text = `\n${indent}console.log(${qc}${emoji} ~ ${ctx} ~ ${varName}:${qc}, ${varName})${semi}`;
    jobs.push({ endLine, text, varName, ctx });
  }

  if (!jobs.length) {
    vscode.window.showInformationMessage('Quick Log: nothing to insert (no var / duplicate).');
    return;
  }

  await editor.edit(eb => {
    for (const j of jobs) {
      const pos = new vscode.Position(j.endLine, doc.lineAt(j.endLine).text.length);
      eb.insert(pos, j.text);
    }
  });
}

async function removeAllLogs() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  const ranges: vscode.Range[] = [];
  for (let i = 0; i < doc.lineCount; i++) {
    const t = doc.lineAt(i).text;
    if (LOG_RE.test(t) || COMMENTED_LOG_RE.test(t)) ranges.push(doc.lineAt(i).rangeIncludingLineBreak);
  }
  if (!ranges.length) { vscode.window.showInformationMessage('Quick Log: no logs found.'); return; }
  await editor.edit(e => ranges.reverse().forEach(r => e.delete(r)));
  vscode.window.showInformationMessage(`Quick Log: removed ${ranges.length} log(s).`);
  updateStatus();
}

async function commentAllLogs() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  const edits: { line: number; text: string; range: vscode.Range }[] = [];
  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i);
    const m = line.text.match(/^(\s*)(console\.log\(["'`]🚀 ~ .+)$/);
    if (m) edits.push({ line: i, text: `${m[1]}// ${m[2]}`, range: line.range });
  }
  if (!edits.length) { vscode.window.showInformationMessage('Quick Log: no active logs to comment.'); return; }
  await editor.edit(e => edits.forEach(x => e.replace(x.range, x.text)));
  vscode.window.showInformationMessage(`Quick Log: commented ${edits.length} log(s).`);
  updateStatus();
}

async function uncommentAllLogs() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  const edits: { text: string; range: vscode.Range }[] = [];
  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i);
    const m = line.text.match(COMMENTED_LOG_RE);
    if (m) edits.push({ text: `${m[1]}${m[2]}`, range: line.range });
  }
  if (!edits.length) { vscode.window.showInformationMessage('Quick Log: no commented logs found.'); return; }
  await editor.edit(e => edits.forEach(x => e.replace(x.range, x.text)));
  vscode.window.showInformationMessage(`Quick Log: uncommented ${edits.length} log(s).`);
  updateStatus();
}
