/**
 * Fix .jsx files by copying from .tsx and stripping only type syntax (safe replacements).
 * Run: node scripts/fix-tsx-to-jsx.cjs
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function walk(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== 'figma') {
      walk(full, callback);
    } else if (e.name.endsWith('.tsx')) {
      callback(full);
    }
  }
}

function stripTypes(content) {
  return content
    .replace(/, type ClassValue\s*/g, ' ')
    .replace(/:\s*React\.ComponentProps<[^>]+>\s*/g, ' ')
    .replace(/\s*&\s*VariantProps<[^>]+>\s*&\s*\{\s*asChild\?\s*:\s*boolean\s*\}/g, '')
    .replace(/\s*&\s*VariantProps<[^>]+>/g, '')
    .replace(/\s*&\s*\{\s*asChild\?\s*:\s*boolean\s*\}/g, '')
    .replace(/:\s*ReactNode\s*/g, ' ')
    .replace(/<boolean\s*\|\s*undefined>/g, '')
    .replace(/\)\s*:\s*void\s*\{/g, ') {')
    .replace(/\)\s*:\s*boolean\s*\{/g, ') {')
    .replace(/\)\s*:\s*string\s*\{/g, ') {')
    .replace(/\)\s*:\s*number\s*\{/g, ') {')
    .replace(/\)\s*:\s*React\.ReactNode\s*\{/g, ') {')
    .replace(/\)\s*:\s*JSX\.Element\s*\{/g, ') {')
    .replace(/\}\s*:\s*\{\s*children\s*:\s*ReactNode\s*\}\s*\)/g, '})')
    .replace(/\}\s*:\s*\{\s*children\s*:\s*ReactNode\s*\}/g, '}')
    .replace(/\bprivate\s+/g, ' ')
    .replace(/\bprotected\s+/g, ' ')
    .replace(/\breadonly\s+/g, ' ')
    .replace(/export\s+function\s+(\w+)\s*<[^>]+>\s*\(/g, 'export function $1(')
    .replace(/function\s+(\w+)\s*<[^>]+>\s*\(/g, 'function $1(')
    .replace(/export\s+default\s+function\s+(\w+)\s*<[^>]+>\s*\(/g, 'export default function $1(')
    .replace(/(\w+)\s*<[^>]+>\s*\(/g, '$1(')
    .replace(/:\s*Intl\.DateTimeFormatOptions\s*=/g, '=')
    .replace(/createContext<[^>]+>\(/g, 'createContext(')
    .replace(/:\s*Record<string,\s*string>\s*=/g, '=')
    .replace(/:\s*Record<string,\s*any>\s*=/g, '=')
    .replace(/\s*:\s*string\s*=\s*'/g, " = '")
    .replace(/\s*:\s*number\s*=\s*/g, ' = ')
    .replace(/\s*:\s*boolean\s*=\s*/g, ' = ')
    .replace(/\s*:\s*\[\]\s*=\s*\[\]/g, ' = []')
    .replace(/\s*:\s*\([^)]*\)\s*=>/g, ' =>')
    .replace(/\s*:\s*\(\)\s*=>/g, ' =>');
}

walk(srcDir, (tsxPath) => {
  const jsxPath = tsxPath.replace(/\.tsx$/, '.jsx');
  let content = fs.readFileSync(tsxPath, 'utf8');
  content = stripTypes(content);
  fs.writeFileSync(jsxPath, content, 'utf8');
  console.log('Fixed:', path.relative(path.join(__dirname, '..'), jsxPath));
});

console.log('Done. Fix any remaining type syntax manually, then delete .ts and .tsx files.');
