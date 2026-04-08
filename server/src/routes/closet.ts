import { Router } from 'express';
import crypto from 'crypto';
import db from '../db/setup';

const router = Router();
const DEV_USER_ID = 'dev-user-001';

const insertItem = db.prepare(
  'INSERT INTO closet_items (id, user_id, category, brand, color) VALUES (@id, @user_id, @category, @brand, @color)'
);

const getItems = db.prepare(
  'SELECT * FROM closet_items WHERE user_id = ? ORDER BY created_at DESC'
);

// GET /api/closet
router.get('/', (_req, res) => {
  try {
    res.json(getItems.all(DEV_USER_ID));
  } catch {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST /api/closet
router.post('/', (req, res) => {
  const { name, category, color } = req.body as {
    name?: string;
    category?: string;
    color?: string;
  };

  if (!category?.trim()) {
    res.status(400).json({ error: 'category is required' });
    return;
  }

  const item = {
    id: crypto.randomUUID(),
    user_id: DEV_USER_ID,
    category: category.trim(),
    brand: name?.trim() ?? null,
    color: color?.trim() ?? null,
  };

  try {
    insertItem.run(item);
    res.status(201).json(item);
  } catch {
    res.status(500).json({ error: 'Failed to save item' });
  }
});

export default router;
