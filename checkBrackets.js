const fs = require('fs');
const path = require('path');

const target = process.argv[2] || 'main.js';
const resolvedTarget = path.resolve(target);
const displayTarget = path.relative(process.cwd(), resolvedTarget) || path.basename(resolvedTarget);
const text = fs.readFileSync(resolvedTarget, 'utf8');
const lines = text.split('\n');

const openToClose = { '(': ')', '{': '}', '[': ']' };
const closeToOpen = { ')': '(', '}': '{', ']': '[' };
const stack = [];

let line = 1;
let column = 1;
let state = 'code';

function pushBracket(char) {
  stack.push({ type: 'bracket', char, line, column });
}

function pushTemplateMarker() {
  stack.push({ type: 'template', line, column });
}

function locationLabel(entry) {
  return `line ${entry.line} col ${entry.column}`;
}

function getLineText(lineNumber) {
  return lines[lineNumber - 1] ?? '';
}

function printContext(lineNumber, columnNumber) {
  const startLine = Math.max(1, lineNumber - 1);
  const endLine = Math.min(lines.length, lineNumber + 1);

  for (let currentLine = startLine; currentLine <= endLine; currentLine++) {
    const prefix = currentLine === lineNumber ? '>' : ' ';
    console.log(`${prefix} ${String(currentLine).padStart(5, ' ')} | ${getLineText(currentLine)}`);
    if (currentLine === lineNumber) {
      console.log(`  ${' '.repeat(5)} | ${' '.repeat(Math.max(0, columnNumber - 1))}^`);
    }
  }
}

for (let i = 0; i < text.length; i++) {
  const ch = text[i];
  const next = text[i + 1];

  if (state === 'lineComment') {
    if (ch === '\n') {
      state = 'code';
    }
  } else if (state === 'blockComment') {
    if (ch === '*' && next === '/') {
      i += 1;
      column += 1;
      state = 'code';
    }
  } else if (state === 'singleQuote') {
    if (ch === '\\') {
      i += 1;
      column += 1;
    } else if (ch === "'") {
      state = 'code';
    }
  } else if (state === 'doubleQuote') {
    if (ch === '\\') {
      i += 1;
      column += 1;
    } else if (ch === '"') {
      state = 'code';
    }
  } else if (state === 'template') {
    if (ch === '\\') {
      i += 1;
      column += 1;
    } else if (ch === '`') {
      state = 'code';
    } else if (ch === '$' && next === '{') {
      pushTemplateMarker();
      state = 'code';
      i += 1;
      column += 1;
    }
  } else {
    if (ch === '/' && next === '/') {
      state = 'lineComment';
      i += 1;
      column += 1;
    } else if (ch === '/' && next === '*') {
      state = 'blockComment';
      i += 1;
      column += 1;
    } else if (ch === "'") {
      state = 'singleQuote';
    } else if (ch === '"') {
      state = 'doubleQuote';
    } else if (ch === '`') {
      state = 'template';
    } else if (ch === '(' || ch === '{' || ch === '[') {
      pushBracket(ch);
    } else if (ch === ')' || ch === ']' || ch === '}') {
      const top = stack[stack.length - 1];

      if (ch === '}' && top && top.type === 'template') {
        stack.pop();
        state = 'template';
      } else if (top && top.type === 'bracket' && top.char === closeToOpen[ch]) {
        stack.pop();
      } else {
        const expected = top && top.type === 'bracket' ? openToClose[top.char] : 'nothing';
        console.log(`MISMATCH in ${displayTarget} at line ${line} col ${column}: found '${ch}', expected '${expected}'`);
        printContext(line, column);
        process.exit(1);
      }
    }
  }

  if (ch === '\n') {
    line += 1;
    column = 1;
  } else {
    column += 1;
  }
}

const unclosed = stack[stack.length - 1];
if (unclosed) {
  if (unclosed.type === 'template') {
    console.log(`UNCLOSED template interpolation in ${displayTarget} opened at ${locationLabel(unclosed)}`);
    printContext(unclosed.line, unclosed.column);
  } else {
    console.log(`UNCLOSED '${unclosed.char}' in ${displayTarget} at ${locationLabel(unclosed)}`);
    printContext(unclosed.line, unclosed.column);
  }
  process.exit(1);
}

console.log(`Brackets balanced OK in ${displayTarget}`);
