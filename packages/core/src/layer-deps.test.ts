import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname);

/** Извлечь пути импорта из файла. */
function getImports(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const matches = content.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g);
  return [...matches].map((m) => m[1]);
}

/** Получить слой (папку верхнего уровня) из пути импорта. */
function layerOf(relativeImport: string, fromFile: string): string | null {
  // Разрешить относительный путь относительно файла
  const resolved = join(dirname(fromFile), relativeImport).replace(/\.ts$/, '');
  // Нормализовать к виду src/<слой>/...
  const rel = resolved.replace(SRC + '/', '').replace(SRC, '');
  const parts = rel.split('/');
  if (parts.length < 2) return null; // файл в корне src/ (types.ts, index.ts)
  return parts[0]; // config | players | eval | equity | strategy
}

/** Все .ts файлы (кроме тестов и index/types) в подпапках. */
function collectLayerFiles(layer: string): string[] {
  const dir = join(SRC, layer);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(dir, f));
}

describe('слойные зависимости (нет циклов, зависимости только вниз)', () => {
  const LAYER_ALLOWS: Record<string, string[]> = {
    // config: ничего не импортирует из слоёв (только ../types)
    config: [],
    // players: только config
    players: ['config'],
    // eval: config (без players/equity/strategy)
    eval: ['config'],
    // equity: eval, config, players
    equity: ['eval', 'config', 'players'],
    // strategy: equity, eval, config, players
    strategy: ['equity', 'eval', 'config', 'players'],
  };

  for (const [layer, allowed] of Object.entries(LAYER_ALLOWS)) {
    it(`слой "${layer}" импортирует только из разрешённых слоёв: [${allowed.join(', ') || 'ничего'}]`, () => {
      const files = collectLayerFiles(layer);
      const violations: string[] = [];
      for (const file of files) {
        const imports = getImports(file);
        for (const imp of imports) {
          const depLayer = layerOf(imp, file);
          if (depLayer && depLayer !== layer && !allowed.includes(depLayer)) {
            violations.push(`${file.replace(SRC + '/', '')} → ${imp} (слой "${depLayer}")`);
          }
        }
      }
      expect(violations, violations.join('\n')).toEqual([]);
    });
  }
});
