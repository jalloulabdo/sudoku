import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ar from '../../src/i18n/locales/ar.json';
import en from '../../src/i18n/locales/en.json';
import fr from '../../src/i18n/locales/fr.json';
import { LOCALES } from '../../src/i18n/locales';
import { TECHNIQUE_ORDER } from '../../src/logic/techniques';

const FILES: Record<string, unknown> = { en, fr, ar };
const PLURAL = /_(zero|one|two|few|many|other)$/;

function flatten(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

describe('locale files', () => {
  it('there is a file for every configured locale', () => {
    expect(Object.keys(FILES).sort()).toEqual(LOCALES.map((l) => l.code).sort());
  });

  it('all locales have exactly the same keys (plural forms aside)', () => {
    const base = (keys: string[]) => [...new Set(keys.map((k) => k.replace(PLURAL, '')))].sort();
    const reference = base(flatten(en));
    for (const [code, data] of Object.entries(FILES)) expect(base(flatten(data)), code).toEqual(reference);
  });

  it('every plural key has every plural form its language needs', () => {
    for (const [code, data] of Object.entries(FILES)) {
      const keys = flatten(data);
      const plurals = new Set(keys.filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')));
      const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
      for (const p of plurals) for (const c of categories) expect(keys, `${code}: ${p}_${c}`).toContain(`${p}_${c}`);
    }
  });

  it('has no empty strings', () => {
    for (const [code, data] of Object.entries(FILES)) {
      const json = JSON.stringify(data);
      expect(json.includes('""'), code).toBe(false);
    }
  });

  it('every hint technique has a title and an explanation', () => {
    const keys = flatten(en);
    for (const tech of TECHNIQUE_ORDER) {
      expect(keys).toContain(`hints.${tech}.title`);
      expect(keys.some((k) => k.startsWith(`hints.${tech}.explain`))).toBe(true);
    }
  });

  it('interpolation placeholders match English in every locale', () => {
    const placeholders = (s: string) => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();
    const get = (obj: unknown, key: string) => key.split('.').reduce<any>((o, k) => o?.[k], obj);
    for (const key of flatten(en)) {
      if (PLURAL.test(key)) continue; // e.g. Arabic "يوم واحد" legitimately omits {{count}}
      const ref = placeholders(get(en, key));
      for (const code of ['fr', 'ar']) expect(placeholders(get(FILES[code], key)), `${code}: ${key}`).toEqual(ref);
    }
  });
});

describe('no hard-coded UI strings', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.tsx')) files.push(p);
    }
  };
  walk(fileURLToPath(new URL('../../src', import.meta.url)));

  it('finds the component files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('JSX text and accessible-name attributes come from translations', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // JSX text containing a letter (Latin or Arabic): after a tag, or between an {expression} and a
      // closing tag (`</`), so TypeScript generics like api<{…}> are not mistaken for text.
      const text = /(?<!=)>([^<>{}()=;[\]]*[A-Za-z؀-ۿ][^<>{}()=;[\]]*)(?=[<{])|}([^<>{}()=;[\]]*[A-Za-z؀-ۿ][^<>{}()=;[\]]*)(?=<\/)/g;
      for (const m of src.matchAll(text)) {
        const s = (m[1] ?? m[2]).trim();
        if (s) offenders.push(`${file}: text "${s}"`);
      }
      for (const m of src.matchAll(/\b(aria-label|title|placeholder|alt)="([^"]*[A-Za-z][^"]*)"/g)) {
        offenders.push(`${file}: ${m[1]}="${m[2]}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
