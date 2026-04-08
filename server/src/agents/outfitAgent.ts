// ─────────────────────────────────────────────────────────────────
// Outfit Agent — the orchestrator
// Calls Style Agent + Context Agent, reads the wardrobe from DB,
// assembles all three reports into a single structured prompt, and
// asks Claude to produce the final OOTD recommendation.
// ─────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk';
import db from '../db/setup';
import { getStyleReport } from './styleAgent';
import { getContextReport } from './contextAgent';
import type { WeatherContext } from './types';

const DEV_USER_ID = 'dev-user-001';

type ClosetRow = {
  category:        string;
  brand:           string | null;
  color:           string | null;
  secondary_color: string | null;
  fabric:          string | null;
  formality:       number | null;
  season:          string | null;
};

export async function generateOutfit(
  userId: string = DEV_USER_ID,
  weather: WeatherContext,
): Promise<string> {
  // ── 1. Wardrobe (Intake Agent output, persisted in DB) ─────────
  const items = db
    .prepare(`
      SELECT category, brand, color, secondary_color, fabric, formality, season
      FROM closet_items
      WHERE user_id = ?
      ORDER BY category
    `)
    .all(userId) as ClosetRow[];

  if (items.length === 0) {
    return "Your wardrobe is empty — scan your closet first so I can style you!";
  }

  // ── 2. Style Agent + Context Agent reports ────────────────────
  //    Both are synchronous (DB reads + pure logic); run sequentially.
  //    In a future async version these would be Promise.all()'d.
  const styleReport   = getStyleReport(userId);
  const contextReport = getContextReport(weather, styleReport.aesthetic);

  // ── 3. Derive target formality (weather + occasion weighted) ──
  const targetFormality = Math.max(1, Math.min(10,
    styleReport.formalityBias + contextReport.formalityAdjustment,
  ));

  // ── 4. Build enriched wardrobe list for prompt ─────────────
  const itemList = items.map((i) => {
    const tags: string[] = [];
    if (i.color) {
      tags.push(`color: ${i.color}${i.secondary_color ? ` / ${i.secondary_color}` : ''}`);
    }
    if (i.fabric)          tags.push(`material: ${i.fabric}`);
    if (i.formality != null) tags.push(`formality: ${i.formality}/10`);
    if (i.season)          tags.push(`season: ${i.season}`);
    const tagStr = tags.length ? ` [${tags.join(' | ')}]` : '';
    return `  - ${i.category}: ${i.brand ?? 'unnamed'}${tagStr}`;
  }).join('\n');

  // ── 5. History / avoid context ────────────────────────────────
  const avoidNote = styleReport.avoidCombinations.length > 0
    ? `\nDo NOT suggest these previously rejected outfit combinations:\n${
        styleReport.avoidCombinations.slice(0, 5).map((c) => `  ✗ ${c}`).join('\n')
      }`
    : '';

  const likedNote = styleReport.likedCategories.length > 0
    ? `Client has enjoyed outfits featuring: ${[...new Set(styleReport.likedCategories)].join(', ')}.`
    : '';

  // ── 6. Orchestrated prompt — all agent reports included ───────
  const prompt = `You are the OOTD Outfit Agent — the final orchestrator in a personal styling pipeline.
You have received structured reports from three specialist agents. Use ALL of them.

It is Spring 2026. The dominant macro trends this season are "Hyper-Functional Minimalism" and "Tech-Texture Layering" — ensure the suggested outfit leans into these if they match the user's aesthetic.

━━ STYLE AGENT REPORT ━━
Aesthetic:          ${styleReport.aesthetic}
Color palette:      ${styleReport.palette   || 'open'}
Dresses for:        ${styleReport.occasion  || 'everyday'}
Style priority:     ${styleReport.priority  || 'comfort & confidence'}
Style icon vibe:    ${styleReport.icon      || 'personal'}
Formality bias:     ${styleReport.formalityBias}/10
${likedNote}${avoidNote}

━━ CONTEXT AGENT REPORT ━━
Weather:            ${contextReport.weatherSummary}
Current season:     ${contextReport.recommendedSeason}
Spring 2026 Trend — "${contextReport.trend.headline}"
${contextReport.trend.details}

━━ INTAKE AGENT REPORT — Full Wardrobe ━━
Target formality for today: ${targetFormality}/10 (occasion + weather weighted)

${itemList}

━━ YOUR TASK ━━
Select a complete, cohesive outfit from the wardrobe above. Favour items whose formality score is closest to ${targetFormality}/10 and whose season tag is ${contextReport.recommendedSeason} or All-Season. The look must:
1. Be weather-appropriate for today: ${contextReport.weatherSummary}
2. Align with the client's ${styleReport.aesthetic} aesthetic
3. Echo the Spring 2026 "${contextReport.trend.headline}" directive
4. Respect their ${styleReport.palette || 'personal'} color palette

Respond in exactly this format — no extra text, no markdown headers:

🧥 LOOK OF THE DAY
[Each selected item on its own line, starting with a dash]

💡 STYLIST TIP
[Exactly 2 sentences. Sentence 1: why this outfit works for today's weather and formality target (${targetFormality}/10). Sentence 2: which Spring 2026 trend it channels and why it fits their ${styleReport.aesthetic} aesthetic.]`;

  // ── 7. Claude call ────────────────────────────────────────────
  const anthropic = new Anthropic();
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const message = await stream.finalMessage();
  const block   = message.content[0];
  return block.type === 'text' ? block.text : 'No advice generated.';
}
