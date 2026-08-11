import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const targets = ['src', 'e2e'];
const extensions = new Set(['.ts', '.tsx', '.css']);

const patterns = [
  { name: 'TODO', regex: /\bTODO\b/ },
  { name: 'FIXME', regex: /\bFIXME\b/ },
  { name: 'as any', regex: /\bas any\b/ },
  { name: ': any', regex: /:\s*any\b/ },
  { name: '@ts-expect-error', regex: /@ts-expect-error/ },
  { name: '@ts-ignore', regex: /@ts-ignore/ },
  { name: 'eslint-disable', regex: /eslint-disable/ },
  { name: '.only(', regex: /\.only\(/ },
  { name: '.skip(', regex: /\.skip\(/ },
];

function walk(dir, files) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, files);
    } else if (extensions.has(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
}

const files = [];
for (const target of targets) {
  try {
    walk(path.join(root, target), files);
  } catch {
    // target directory does not exist; nothing to scan there
  }
}

let findings = 0;

for (const file of files) {
  const relPath = path.relative(root, file).split(path.sep).join('/');
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        console.log(`${relPath}:${index + 1}  ${pattern.name}`);
        findings += 1;
      }
    }
  });
}

if (findings > 0) {
  process.exit(1);
} else {
  console.log('check:clean OK — 0 findings');
  process.exit(0);
}
