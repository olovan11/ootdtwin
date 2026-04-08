import { Router } from 'express';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db/setup';

const router = Router();
const DEV_USER_ID = 'dev-user-001';

type DetectedItem = {
  name: string;
  category: 'Top' | 'Bottom' | 'Shoes' | 'Outerwear' | 'Accessory';
  color: string;
};

// POST /api/analyze/closet
// Body: { frames: string[] }  — base64 JPEG, max 6 frames
router.post('/closet', async (req, res) => {
  const { frames } = req.body as { frames?: string[] };

  if (!frames || frames.length === 0) {
    res.status(400).json({ error: 'No frames provided' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'Anthropic API key not configured' });
    return;
  }

  try {
    const selected = frames.slice(0, 6);
    const client = new Anthropic();

    const imageBlocks: Anthropic.ImageBlockParam[] = selected.map((frame) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: frame },
    }));

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text: `These are frames from a video walk-through of a clothing closet.
Identify every distinct clothing item you can clearly see across all frames.
Combine duplicates — only list each item once.
Return ONLY a valid JSON array. No markdown, no prose, no code fences.
Each object must have exactly these fields:
  "name": short descriptive name (e.g. "White Oxford Shirt", "Dark Wash Slim Jeans")
  "category": one of Top | Bottom | Shoes | Outerwear | Accessory
  "color": primary color as a simple word (e.g. "white", "navy", "olive")`,
            },
          ],
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type');

    const match = block.text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');

    const detected = JSON.parse(match[0]) as DetectedItem[];

    // Deduplicate by name+category
    const seen = new Set<string>();
    const unique = detected.filter((item) => {
      const key = `${item.category}:${item.name}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const insert = db.prepare(
      'INSERT INTO closet_items (id, user_id, category, brand, color) VALUES (@id, @user_id, @category, @brand, @color)'
    );

    const saved = unique.map((item) => {
      const row = {
        id: crypto.randomUUID(),
        user_id: DEV_USER_ID,
        category: item.category,
        brand: item.name,
        color: item.color ?? null,
      };
      insert.run(row);
      return row;
    });

    res.json({ items: saved, count: saved.length });
  } catch (err) {
    console.error('Closet analysis error:', err);
    res.status(500).json({ error: 'Failed to analyze closet video' });
  }
});

export default router;
