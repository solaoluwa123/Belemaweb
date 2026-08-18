/**
 * Converts TypeScript/TSX files to JavaScript/JSX by stripping type annotations.
 * Run from project root: node scripts/convert-to-js.cjs
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const rootDir = path.join(__dirname, '..');

function getAllFiles(dir, ext) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'figma') {
          results = results.concat(getAllFiles(fullPath, ext));
        }
      } else if (entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch (e) {}
  return results;
}

function stripTypeScript(content, isJsx) {
  let code = content;

  // Remove interface blocks (multiline)
  code = code.replace(/export\s+interface\s+\w+\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g, '');
  code = code.replace(/interface\s+\w+\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g, '');

  // Remove type alias (single line)
  code = code.replace(/export\s+type\s+\w+\s*=\s*[^;]+;/g, '');
  code = code.replace(/type\s+\w+\s*=\s*[^;]+;/g, '');

  // Remove : Type from function parameters (including generics like <T>)
  code = code.replace(/(\w+)\s*:\s*([^,\)\]\}\=]+?)(?=\s*[,\)\]\}])/g, (m, name, type) => {
    if (type.includes('=>') || type.trim().startsWith('(')) return m;
    return name;
  });

  // Remove return type : Type
  code = code.replace(/\)\s*:\s*([^\{=]+?)\s*(\{)/g, ') $2');
  code = code.replace(/\)\s*:\s*([^\{=]+?)\s*=>/g, ') =>');

  // Remove generic type params from functions/components
  code = code.replace(/function\s+\w+\s*<[^>]+>(\s*\()/g, 'function $1');
  code = code.replace(/export\s+function\s+\w+\s*<[^>]+>(\s*\()/g, 'export function $1');
  code = code.replace(/(\w+)\s*<[^>]+>(\s*\{)/g, '$1$2');
  code = code.replace(/(\w+)\s*<[^>]+>(\s*\()/g, '$1$2');

  // Remove variable type annotations
  code = code.replace(/(\w+)\s*:\s*(React\.\w+(\s*\|\s*null)?)\s*=/g, '$1 =');
  code = code.replace(/(const|let|var)\s+(\w+)\s*:\s*[^=]+=\s*/g, '$1 $2 = ');

  // Remove as Type (but keep as const)
  code = code.replace(/\s+as\s+(?!const)(?!\w+\.)[\w<>,\s\[\]|&{}]+/g, '');

  // Remove React.ComponentProps, VariantProps, etc.
  code = code.replace(/:\s*React\.ComponentProps<[^>]+>\s*&\s*/g, '');
  code = code.replace(/:\s*VariantProps<[^>]+>\s*&\s*/g, '');
  code = code.replace(/&\s*\{\s*asChild\?\s*:\s*boolean\s*\}/g, '');

  // Remove private, protected, readonly from class members
  code = code.replace(/\s+(private|protected|readonly)\s+/g, ' ');

  // Remove NodeJS.Timeout, etc.
  code = code.replace(/:\s*NodeJS\.Timeout\s*\|\s*null/g, '');
  code = code.replace(/:\s*number\[\]\s*=\s*\[\]/g, '= []');

  // Remove Record<..., ...>, Map<...>
  code = code.replace(/:\s*Record<string,\s*[^>]+>/g, '');
  code = code.replace(/:\s*Map<string,\s*[^>]+>/g, '');

  // Remove import type
  code = code.replace(/import\s+type\s+\{[^}]+\}\s+from\s+[^;]+;/g, '');
  code = code.replace(/import\s+\{\s*type\s+[^}]+\}\s+from\s+[^;]+;/g, '');

  // Remove type from clsx import
  code = code.replace(/import\s+\{\s*clsx,\s*type\s+ClassValue\s*\}\s+from/g, 'import { clsx } from');

  // Fix createContext<...>(...)
  code = code.replace(/createContext<[^>]+>\(/g, 'createContext(');

  // Remove : void, : boolean, etc from method declarations
  code = code.replace(/\s*\)\s*:\s*void\s*\{/g, ') {');
  code = code.replace(/\s*\)\s*:\s*boolean\s*\{/g, ') {');
  code = code.replace(/\s*\)\s*:\s*Promise<[^>]+>\s*\{/g, ') {');
  code = code.replace(/\s*\)\s*:\s*string\s*\{/g, ') {');
  code = code.replace(/\s*\)\s*:\s*number\s*\{/g, ') {');

  return code;
}

// Process .ts files
const tsFiles = [...getAllFiles(srcDir, '.ts'), path.join(rootDir, 'vite.config.ts')];
for (const file of tsFiles) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const outPath = file.replace(/\.ts$/, '.js');
  const converted = stripTypeScript(content, false);
  fs.writeFileSync(outPath, converted, 'utf8');
  console.log('Converted:', path.relative(rootDir, file), '->', path.relative(rootDir, outPath));
}

// Process .tsx files
const tsxFiles = getAllFiles(srcDir, '.tsx');
for (const file of tsxFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const outPath = file.replace(/\.tsx$/, '.jsx');
  const converted = stripTypeScript(content, true);
  fs.writeFileSync(outPath, converted, 'utf8');
  console.log('Converted:', path.relative(rootDir, file), '->', path.relative(rootDir, outPath));
}

console.log('Done. Remove old .ts and .tsx files manually or run cleanup.');
