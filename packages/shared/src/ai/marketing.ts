// Contenus marketing par l'IA (section 13, S17) : choix de la paire avant/après, zones à flouter,
// légendes en trois tons. L'IA ne reçoit que les photos, les intitulés des travaux et la ville :
// jamais l'adresse ni le nom du client. Modèle photo (rapide et économique, CLAUDE.md).
// Fichier recopié pour les Edge Functions (voir deno-copy.ts) : imports relatifs « ./ » seulement.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

export const MARKETING_MODEL = 'claude-haiku-5-5';

export type MarketingImage = { base64: string; mediaType: 'image/jpeg' | 'image/png' };
export type CandidatePhoto = {
  id: string;
  phase: 'avant' | 'apres';
  label: string | null;
  image: MarketingImage;
};

export type AiUsage = { model: string; inputTokens: number; outputTokens: number };
export type AiFailure = { ok: false; kind: 'retry' | 'refused' | 'invalid'; message: string };

// --- 1. Choix de la paire ---------------------------------------------------------------------

export const pairSchema = z.object({
  before: z.string(),
  after: z.string(),
  reason: z.string(),
});

export const PAIR_SYSTEM_PROMPT = [
  'Tu choisis la meilleure paire de photos avant/après d’un chantier de rénovation énergétique,',
  'pour une publication de l’entreprise sur les réseaux sociaux.',
  'Critères, dans l’ordre : même cadrage et même point de vue, bonne lumière, netteté, travaux',
  'bien visibles sur la photo après, aucune personne au premier plan.',
  'before : référence d’une photo A (avant). after : référence d’une photo B (après).',
  'reason : une phrase courte en français.',
].join('\n');

/** Références courtes : A1, A2… pour l'avant ; B1, B2… pour l'après (ordre reçu). */
export function candidateRefs(photos: readonly CandidatePhoto[]): Map<string, CandidatePhoto> {
  const refs = new Map<string, CandidatePhoto>();
  let a = 0;
  let b = 0;
  for (const p of photos) refs.set(p.phase === 'avant' ? `A${++a}` : `B${++b}`, p);
  return refs;
}

// --- 2. Zones à flouter et légendes -----------------------------------------------------------

const region = z.object({
  kind: z.enum(['face', 'plate', 'street_number']),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
export const composeSchema = z.object({
  before_regions: z.array(region),
  after_regions: z.array(region),
  captions: z.object({ sobre: z.string(), chaleureux: z.string(), technique: z.string() }),
});
export type ComposeDraft = z.infer<typeof composeSchema>;

export type ComposeContext = { works: string[]; city: string | null; company: string };

export const COMPOSE_SYSTEM_PROMPT = [
  'Tu prépares une publication avant/après pour une entreprise de rénovation énergétique.',
  'Image 1 : photo avant. Image 2 : photo après.',
  'Zones : repère sur chaque photo tout visage, plaque d’immatriculation et numéro de rue ou de',
  'maison lisible. Rectangle en fractions de l’image (x, y : coin haut gauche ; w, h : taille,',
  'de 0 à 1). En cas de doute, signale la zone. Liste vide si rien.',
  'Légendes en français, 2 à 4 phrases, prêtes pour une fiche Google, Facebook, Instagram ou',
  'LinkedIn : sobre (factuelle), chaleureux (proche, une émoji au plus), technique (équipement',
  'et gain attendu, sans chiffre inventé). Tu peux citer la ville et les travaux fournis.',
  'Jamais d’adresse, de rue, de nom de client, de prix, ni de promesse d’économie chiffrée.',
].join('\n');

export function buildComposePrompt(ctx: ComposeContext): string {
  return [
    `Entreprise : ${ctx.company}`,
    `Ville : ${ctx.city ?? 'non précisée'}`,
    `Travaux : ${ctx.works.join(' ; ') || 'rénovation énergétique'}`,
  ].join('\n');
}

// --- Fournisseur ------------------------------------------------------------------------------

export type PairResult =
  ({ ok: true; beforeId: string; afterId: string; reason: string } & AiUsage) | AiFailure;
export type ComposeResult = ({ ok: true; draft: ComposeDraft } & AiUsage) | AiFailure;

export interface MarketingAi {
  choosePair(photos: CandidatePhoto[]): Promise<PairResult>;
  compose(
    before: MarketingImage,
    after: MarketingImage,
    ctx: ComposeContext,
  ): Promise<ComposeResult>;
}

const imageBlock = (image: MarketingImage) => ({
  type: 'image' as const,
  source: { type: 'base64' as const, media_type: image.mediaType, data: image.base64 },
});

function failure(error: unknown): AiFailure {
  if (
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.InternalServerError ||
    error instanceof Anthropic.APIConnectionError
  ) {
    return { ok: false, kind: 'retry', message: error.message };
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return { ok: false, kind: 'retry', message: 'clé API refusée' };
  }
  if (error instanceof Anthropic.APIError) {
    return { ok: false, kind: 'invalid', message: `API ${error.status} : ${error.message}` };
  }
  return { ok: false, kind: 'invalid', message: String(error) };
}

/** Choix valide : une photo avant et une photo après existantes ; sinon null. */
export function resolvePair(
  photos: readonly CandidatePhoto[],
  before: string,
  after: string,
): { beforeId: string; afterId: string } | null {
  const refs = candidateRefs(photos);
  const b = refs.get(before.trim().toUpperCase());
  const a = refs.get(after.trim().toUpperCase());
  if (!b || !a || b.phase !== 'avant' || a.phase !== 'apres') return null;
  return { beforeId: b.id, afterId: a.id };
}

export function createClaudeMarketingAi({
  client,
  model = MARKETING_MODEL,
}: {
  client: Anthropic;
  model?: string;
}): MarketingAi {
  return {
    async choosePair(photos) {
      try {
        const refs = candidateRefs(photos);
        const content = [...refs].flatMap(([ref, p]) => [
          { type: 'text' as const, text: `${ref}${p.label ? ` — ${p.label}` : ''}` },
          imageBlock(p.image),
        ]);
        const response = await client.messages.parse({
          model,
          max_tokens: 1024,
          output_config: { effort: 'low', format: zodOutputFormat(pairSchema) },
          system: PAIR_SYSTEM_PROMPT,
          messages: [{ role: 'user', content }],
        });
        if (response.stop_reason === 'refusal') {
          return { ok: false, kind: 'refused', message: 'choix décliné par le modèle' };
        }
        const parsed = response.parsed_output;
        const pair = parsed ? resolvePair(photos, parsed.before, parsed.after) : null;
        if (!parsed || !pair) {
          return {
            ok: false,
            kind: 'invalid',
            message: `paire illisible (${response.stop_reason})`,
          };
        }
        return {
          ok: true,
          ...pair,
          reason: parsed.reason,
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
      } catch (error) {
        return failure(error);
      }
    },
    async compose(before, after, ctx) {
      try {
        const response = await client.messages.parse({
          model,
          max_tokens: 2048,
          output_config: { effort: 'low', format: zodOutputFormat(composeSchema) },
          system: COMPOSE_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                imageBlock(before),
                imageBlock(after),
                { type: 'text', text: buildComposePrompt(ctx) },
              ],
            },
          ],
        });
        if (response.stop_reason === 'refusal') {
          return { ok: false, kind: 'refused', message: 'publication déclinée par le modèle' };
        }
        if (!response.parsed_output) {
          return {
            ok: false,
            kind: 'invalid',
            message: `réponse illisible (${response.stop_reason})`,
          };
        }
        return {
          ok: true,
          draft: response.parsed_output,
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
      } catch (error) {
        return failure(error);
      }
    },
  };
}

/** Fournisseur factice (tests, CI) : première photo avant, dernière après, rien à flouter. */
export function createFakeMarketingAi(): MarketingAi {
  const usage = { model: 'fake', inputTokens: 0, outputTokens: 0 };
  return {
    async choosePair(photos) {
      const before = photos.find((p) => p.phase === 'avant');
      const after = [...photos].reverse().find((p) => p.phase === 'apres');
      if (!before || !after) return { ok: false, kind: 'invalid', message: 'paire incomplète' };
      return { ok: true, beforeId: before.id, afterId: after.id, reason: 'factice', ...usage };
    },
    async compose(_before, _after, ctx) {
      const works = ctx.works.join(', ') || 'rénovation énergétique';
      const where = ctx.city ? ` à ${ctx.city}` : '';
      return {
        ok: true,
        draft: {
          before_regions: [],
          after_regions: [],
          captions: {
            sobre: `Chantier terminé${where} : ${works}.`,
            chaleureux: `Encore un beau chantier${where} ! ${works}.`,
            technique: `Réalisation${where} : ${works}, posé par ${ctx.company}.`,
          },
        },
        ...usage,
      };
    },
  };
}
