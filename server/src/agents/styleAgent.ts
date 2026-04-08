// ─────────────────────────────────────────────────────────────────
// Style Agent — manages Style DNA
// Reads the user quiz answers + rated outfit history to produce
// a StyleReport that weights the Outfit Agent's decisions.
// ─────────────────────────────────────────────────────────────────

import db from '../db/setup';
import type { StyleReport } from './types';

const DEV_USER_ID = 'dev-user-001';

// Maps quiz "occasion" answers to a 1–10 formality target
const FORMALITY_BY_OCCASION: Record<string, number> = {
  'Work / Office':    7,
  'Weekend / Casual': 3,
  'Date Night':       7,
  'Athletic':         2,
  'Smart Casual':     5,
};

type ProfileRow  = { aesthetic_pref: string; color_palette: string };
type HistoryRow  = { items_json: string; rating: number | null };
type FeedbackRow = { outfit_json: string; rating: number };

export function getStyleReport(userId: string = DEV_USER_ID): StyleReport {
  // ── 1. Quiz profile ────────────────────────────────────────────
  const row = db
    .prepare('SELECT aesthetic_pref, color_palette FROM style_profiles WHERE user_id = ?')
    .get(userId) as ProfileRow | undefined;

  let aesthetic = 'Classic';
  let palette   = '';
  let occasion  = '';
  let priority  = '';
  let icon      = '';

  if (row) {
    aesthetic = row.aesthetic_pref ?? 'Classic';
    try {
      const extras = JSON.parse(row.color_palette ?? '{}');
      palette  = extras.palette  ?? '';
      occasion = extras.occasion ?? '';
      priority = extras.priority ?? '';
      icon     = extras.icon     ?? '';
    } catch { /* ignore malformed JSON */ }
  }

  const formalityBias = FORMALITY_BY_OCCASION[occasion] ?? 5;

  // ── 2. Outfit history — extract liked / disliked categories ────
  const history = db
    .prepare('SELECT items_json, rating FROM outfit_history WHERE user_id = ? ORDER BY worn_on DESC LIMIT 20')
    .all(userId) as HistoryRow[];

  const likedCategories: string[]    = [];
  const dislikedCategories: string[] = [];

  for (const h of history) {
    if (!h.rating) continue;
    try {
      const cats: string[] = JSON.parse(h.items_json);
      if (h.rating >= 4) likedCategories.push(...cats);
      else if (h.rating <= 2) dislikedCategories.push(...cats);
    } catch { /* ignore */ }
  }

  // ── 3. User feedback — item combos to avoid ───────────────────
  const avoidCombinations: string[] = [];
  try {
    const feedback = db
      .prepare(`SELECT outfit_json, rating FROM user_feedback
                WHERE user_id = ? AND rating = 1
                ORDER BY created_at DESC LIMIT 10`)
      .all(userId) as FeedbackRow[];

    for (const f of feedback) {
      try {
        avoidCombinations.push(f.outfit_json);
      } catch { /* ignore */ }
    }
  } catch { /* user_feedback table may not exist yet */ }

  return {
    aesthetic,
    palette,
    occasion,
    priority,
    icon,
    formalityBias,
    likedCategories,
    dislikedCategories,
    avoidCombinations,
  };
}
