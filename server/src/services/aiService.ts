import Anthropic from '@anthropic-ai/sdk';
import db from '../db/setup';

const DEV_USER_ID = 'dev-user-001';

type ClosetRow = { category: string; brand: string | null; color: string | null };
type ProfileRow = { aesthetic_pref: string; color_palette: string };

export type WeatherContext = {
  city: string;
  temp: number;
  feels_like: number;
  description: string;
} | null;

const SPRING_2026_TRENDS: Record<string, { headline: string; details: string }> = {
  Minimalist: {
    headline: 'Quiet Luxury',
    details: 'Tonal layering, premium fabrications, and deliberately understated silhouettes. Nothing loud — everything intentional.',
  },
  Classic: {
    headline: 'Old Money Revived',
    details: 'Relaxed tailoring with a lived-in ease. Neutral palettes, natural fibres, and timeless cuts that never chase a trend.',
  },
  Streetwear: {
    headline: 'Utility Cool',
    details: 'Functional pockets, cargo detailing, and oversized proportions softened with clean footwear. Functional meets editorial.',
  },
  Bohemian: {
    headline: 'Modern Folk',
    details: 'Earthy tones, flowing silhouettes, and artisan-inspired textures. Effortlessly layered, never fussy.',
  },
  Preppy: {
    headline: 'Coastal Prep',
    details: 'Nautical palettes, structured silhouettes, and polished accessories. Think weekend-on-the-water meets Ivy League.',
  },
  Bold: {
    headline: 'Maximalist Confidence',
    details: 'Unapologetic color-blocking, pattern mixing, and statement pieces. The rule: if you can feel it, wear it louder.',
  },
};

function buildTrendSection(aesthetic: string): string {
  const trend = SPRING_2026_TRENDS[aesthetic] ?? {
    headline: 'Effortless Personal Style',
    details: 'Pieces that feel intentional and true to the wearer — comfort and personality in equal measure.',
  };
  return `Spring 2026 Trend — "${trend.headline}"\n${trend.details}`;
}

export async function getStylingAdvice(weather: WeatherContext): Promise<string> {
  // ── Wardrobe ──────────────────────────────────────────────────
  const items = db
    .prepare('SELECT category, brand, color FROM closet_items WHERE user_id = ? ORDER BY category')
    .all(DEV_USER_ID) as ClosetRow[];

  if (items.length === 0) {
    return "Your wardrobe is empty — scan your closet first so I can style you!";
  }

  // ── Style profile ─────────────────────────────────────────────
  const profileRow = db
    .prepare('SELECT aesthetic_pref, color_palette FROM style_profiles WHERE user_id = ?')
    .get(DEV_USER_ID) as ProfileRow | undefined;

  let aesthetic = 'Classic';
  let palette = '';
  let occasion = '';
  let priority = '';
  let icon = '';

  if (profileRow) {
    aesthetic = profileRow.aesthetic_pref ?? 'Classic';
    try {
      const extras = JSON.parse(profileRow.color_palette ?? '{}');
      palette  = extras.palette  ?? '';
      occasion = extras.occasion ?? '';
      priority = extras.priority ?? '';
      icon     = extras.icon     ?? '';
    } catch { /* ignore */ }
  }

  // ── Build context strings ──────────────────────────────────────
  const itemList = items
    .map((i) => `  - ${i.category}: ${i.brand ?? 'unnamed'}${i.color ? ` (${i.color})` : ''}`)
    .join('\n');

  const weatherText = weather
    ? `${weather.description}, ${weather.temp}°F — feels like ${weather.feels_like}°F in ${weather.city}`
    : 'Weather data unavailable — style for a mild spring day.';

  const trendSection = buildTrendSection(aesthetic);

  const profileLines = [
    `Aesthetic:        ${aesthetic}`,
    palette  ? `Color palette:    ${palette}`  : '',
    occasion ? `Dresses for:      ${occasion}` : '',
    priority ? `Style priority:   ${priority}` : '',
    icon     ? `Style icon vibe:  ${icon}`     : '',
  ].filter(Boolean).join('\n');

  // ── Prompt ────────────────────────────────────────────────────
  const prompt = `You are a world-class personal stylist and fashion editor.

━━ CLIENT STYLE PROFILE ━━
${profileLines}

━━ SPRING 2026 TREND DIRECTIVE ━━
${trendSection}

━━ TODAY'S WEATHER — Lexington, VA ━━
${weatherText}

━━ FULL WARDROBE (use ONLY these items) ━━
${itemList}

━━ YOUR TASK ━━
Select a complete, cohesive outfit from the wardrobe above. The look must:
1. Be weather-appropriate for today's conditions
2. Align with the client's ${aesthetic} aesthetic
3. Echo the Spring 2026 trend directive
4. Respect their ${palette || 'personal'} color palette

Respond in exactly this format — no extra text, no markdown headers:

🧥 LOOK OF THE DAY
[Each selected item on its own line, starting with a dash]

💡 STYLIST TIP
[Exactly 2 sentences. Sentence 1: why this outfit works for today's weather. Sentence 2: which specific Spring 2026 trend it channels and why it fits their ${aesthetic} aesthetic.]`;

  // ── Claude call ───────────────────────────────────────────────
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const message = await stream.finalMessage();
  const block = message.content[0];
  return block.type === 'text' ? block.text : 'No advice generated.';
}
