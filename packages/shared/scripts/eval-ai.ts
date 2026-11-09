// Évaluation du pré-contrôle IA sur un dossier de photos annotées (section 8, S10).
//   pnpm --filter @preuvio/shared eval:ai fixtures/ai-eval          (vrai modèle, clé requise)
//   pnpm --filter @preuvio/shared eval:ai fixtures/ai-eval --fake   (à blanc, sans appel)
// Chaque photo coûte un appel au modèle : l'évaluation complète se lance à la main.
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createClaudeAnalyzer,
  createFakeAnalyzer,
  evaluate,
  formatReport,
  parseManifest,
  type ManifestEntry,
} from '../src/ai';

const [dir, flag] = process.argv.slice(2);
if (!dir) {
  console.error('Usage : eval:ai <dossier> [--fake]');
  process.exit(2);
}
const cases = parseManifest(
  JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as ManifestEntry[],
);
const fake = flag === '--fake';
if (!fake && !process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY absente : ajoutez --fake pour un essai à blanc.');
  process.exit(2);
}
const analyzer = fake ? createFakeAnalyzer() : createClaudeAnalyzer({ client: new Anthropic() });
const report = await evaluate(cases, analyzer, async (file) => ({
  base64: readFileSync(join(dir, file)).toString('base64'),
  mediaType: file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
}));
console.log(formatReport(report));
writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\nDétail : ${join(dir, 'report.json')}`);
