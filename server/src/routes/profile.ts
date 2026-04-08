import { Router } from 'express';
import crypto from 'crypto';
import db from '../db/setup';

const router = Router();
const DEV_USER_ID = 'dev-user-001';

type StyleProfile = {
  aesthetic: string;
  palette: string;
  occasion: string;
  priority: string;
  icon: string;
};

// GET /api/profile
router.get('/', (_req, res) => {
  const row = db
    .prepare('SELECT * FROM style_profiles WHERE user_id = ?')
    .get(DEV_USER_ID) as { aesthetic_pref: string; color_palette: string } | undefined;

  if (!row) {
    res.json(null);
    return;
  }

  try {
    const extra = JSON.parse(row.color_palette ?? '{}');
    res.json({ aesthetic: row.aesthetic_pref, ...extra });
  } catch {
    res.json({ aesthetic: row.aesthetic_pref });
  }
});

// POST /api/profile
router.post('/', (req, res) => {
  const { aesthetic, palette, occasion, priority, icon } = req.body as StyleProfile;

  db.prepare(`
    INSERT INTO style_profiles (id, user_id, aesthetic_pref, color_palette)
    VALUES (@id, @user_id, @aesthetic_pref, @color_palette)
    ON CONFLICT(user_id) DO UPDATE SET
      aesthetic_pref = excluded.aesthetic_pref,
      color_palette  = excluded.color_palette
  `).run({
    id: crypto.randomUUID(),
    user_id: DEV_USER_ID,
    aesthetic_pref: aesthetic,
    color_palette: JSON.stringify({ palette, occasion, priority, icon }),
  });

  res.json({ ok: true });
});

export default router;
