import { lifeAdminEn, lifeAdminTr } from '../strings/lifeAdmin';
import { assistantEn, assistantTr } from '../strings/assistant';
import type { Language } from './language';

const commonEn = {
  language: 'Language', system: 'System language', en: 'English', tr: 'Turkish',
  save: 'Save', cancel: 'Cancel', reload: 'Reload saved language',
  errors: {
    load: 'Saved language could not be read safely. Reload before changing it.',
    save: 'The language save could not be verified. Reload and review the saved language before trying again.',
    conflict: 'The saved language changed. Reload and review it before changing it again.',
  },
};
const commonTr: typeof commonEn = {
  language: 'Dil', system: 'Sistem dili', en: 'İngilizce', tr: 'Türkçe',
  save: 'Kaydet', cancel: 'Vazgeç', reload: 'Kayıtlı dili yeniden yükle',
  errors: {
    load: 'Kayıtlı dil güvenle okunamadı. Değiştirmeden önce yeniden yükleyin.',
    save: 'Dil kaydı doğrulanamadı. Tekrar denemeden önce kayıtlı dili yeniden yükleyip inceleyin.',
    conflict: 'Kayıtlı dil değişti. Tekrar değiştirmeden önce yeniden yükleyip inceleyin.',
  },
};

export type Catalog = {
  common: typeof commonEn;
  lifeAdmin: typeof lifeAdminEn;
  assistant: typeof assistantEn;
};

/** Existing feature translations retain their original object identity and signatures. */
export const catalog: Record<Language, Catalog> = {
  en: { common: commonEn, lifeAdmin: lifeAdminEn, assistant: assistantEn },
  tr: { common: commonTr, lifeAdmin: lifeAdminTr, assistant: assistantTr },
};

const placeholders = (text: string): string =>
  [...new Set([...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]))].sort().join(',');
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** Code-catalog check only. Functions are not executed; arity is checked, TS checks parameter types. */
export function catalogIssues(candidate: unknown, reference: unknown = catalog.en): string[] {
  const issues: string[] = [];
  function visit(expected: unknown, actual: unknown, path: string) {
    if (typeof expected === 'string') {
      if (typeof actual !== 'string') issues.push(`${path}: type`);
      else if (actual.trim().length === 0) issues.push(`${path}: empty`);
      else if (placeholders(expected) !== placeholders(actual)) issues.push(`${path}: placeholders`);
    } else if (typeof expected === 'function') {
      if (typeof actual !== 'function') issues.push(`${path}: type`);
      else if (expected.length !== actual.length) issues.push(`${path}: function arity`);
    } else if (object(expected)) {
      if (!object(actual)) { issues.push(`${path}: type`); return; }
      for (const key of Object.keys(expected)) {
        if (!Object.hasOwn(actual, key)) issues.push(`${path}.${key}: missing`);
        else visit(expected[key], actual[key], `${path}.${key}`);
      }
      for (const key of Object.keys(actual)) if (!Object.hasOwn(expected, key)) issues.push(`${path}.${key}: extra`);
    } else issues.push(`${path}: unsupported reference`);
  }
  visit(reference, candidate, 'catalog');
  return issues;
}
