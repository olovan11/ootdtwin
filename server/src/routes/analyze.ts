import { Router } from 'express';
import crypto from 'crypto';
import db from '../db/setup';
import { analyzeFrames } from '../agents/intakeAgent';

const router = Router();
const DEV_USER_ID = 'dev-user-001';

// POST /api/analyze/closet
// Body: { frames: string[] }  — base64 JPEG, max 6 frames
// Delegates to the Intake Agent for enriched computer-vision tagging.
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
    // ── Intake Agent: vision → enriched item list ────────────────
    const detected = await analyzeFrames(frames);

    // ── Persist to DB ────────────────────────────────────────────
    const insert = db.prepare(`
      INSERT INTO closet_items
        (id, user_id, category, brand, color, secondary_color, fabric, formality, season)
      VALUES
        (@id, @user_id, @category, @brand, @color, @secondary_color, @fabric, @formality, @season)
    `);

    const saved = detected.map((item) => {
      const row = {
        id:              crypto.randomUUID(),
        user_id:         DEV_USER_ID,
        category:        item.category,
        brand:           item.name,
        color:           item.primaryColor   ?? null,
        secondary_color: item.secondaryColor ?? null,
        fabric:          item.material       ?? null,
        formality:       item.formality      ?? null,
        season:          item.season         ?? null,
      };
      insert.run(row);
      return row;
    });

    res.json({ items: saved, count: saved.length });
  } catch (err) {
    console.error('Intake Agent error:', err);
    res.status(500).json({ error: 'Failed to analyze closet video' });
  }
});

export default router;
