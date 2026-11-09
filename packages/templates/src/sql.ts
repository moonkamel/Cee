// Publication des modèles globaux : la migration SQL est générée depuis les fichiers JSON,
// et un test vérifie qu'elle reste identique (UPDATE_TEMPLATES_SQL=1 pour la réécrire).
import { createHash } from 'node:crypto';
import { parseTemplate } from '@preuvio/shared';
import { globalTemplates } from './index';

/** Identifiant stable d'un modèle global : le même partout (local, CI, hébergé). */
export function templateId(code: string, version: string): string {
  const h = createHash('sha256').update(`preuvio-template:${code}@${version}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const literal = (s: string) => `'${s.replaceAll("'", "''")}'`;

export function globalTemplatesSql(): string {
  const rows = globalTemplates.map((raw) => {
    const t = parseTemplate(raw);
    return `  (${[
      literal(templateId(t.code, t.version)),
      'null',
      literal(t.code),
      literal(t.trade),
      literal(t.version),
      literal(t.title),
      t.cee_operation ? literal(t.cee_operation) : 'null',
      `${literal(JSON.stringify(raw))}::jsonb`,
      'true',
    ].join(', ')})`;
  });
  return [
    '-- Généré depuis packages/templates/src/global/*.json : ne pas modifier à la main.',
    '-- Modèles globaux V1 (section 7), en brouillon tant qu’un professionnel ne les a pas relus.',
    '-- Une version publiée ne change plus : une correction est une nouvelle version.',
    'insert into public.checklist_templates',
    '  (id, company_id, code, trade, version, title, cee_operation, content, published)',
    'values',
    rows.join(',\n'),
    'on conflict (company_id, code, version) do nothing;',
    '',
  ].join('\n');
}
