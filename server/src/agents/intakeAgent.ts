// ─────────────────────────────────────────────────────────────────
// Intake Agent — computer vision specialist
// Receives raw video frames and produces a fully-tagged EnrichedItem
// array: name, colors, material, formality score, season.
// ─────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk';
import type { EnrichedItem } from './types';

const client = new Anthropic();

export async function analyzeFrames(frames: string[]): Promise<EnrichedItem[]> {
  const selected = frames.slice(0, 6);

  const imageBlocks: Anthropic.ImageBlockParam[] = selected.map((frame) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: frame },
  }));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text',
            text: `Act as the OOTD Intake Agent. Analyze these frames from a closet walk-through video.

For every distinct clothing item you can clearly see across all frames, identify:

- name: descriptive item name (e.g. "Slim-fit Chinos", "White Oxford Shirt", "Oversized Denim Jacket")
- category: one of Top | Bottom | Shoes | Outerwear | Accessory
- primaryColor: dominant color as a single lowercase word (e.g. "navy", "white", "olive", "camel")
- secondaryColor: secondary color if clearly present, otherwise null
- material: fabric type (e.g. "Denim", "Linen", "Wool", "Cotton", "Silk", "Cashmere", "Synthetic", "Leather")
- formality: integer 1–10 where 1 = athletic/loungewear, 5 = smart-casual, 10 = black-tie
- season: best season for this item — one of Spring | Summer | Fall | Winter | All-Season

Rules:
- Combine duplicates — only list each item once.
- If you cannot clearly identify a field, make your best inference from what is visible.
- Return ONLY a valid JSON array. No markdown, no prose, no code fences.

Return this as a structured JSON array to be saved in our SQLite DB.`,
          },
        ],
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Intake Agent: unexpected response type from Claude');

  const match = block.text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Intake Agent: no JSON array in Claude response');

  const raw = JSON.parse(match[0]) as EnrichedItem[];

  // Deduplicate by category + name
  const seen = new Set<string>();
  return raw.filter((item) => {
    const key = `${item.category}:${item.name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
