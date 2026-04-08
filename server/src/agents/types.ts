// ─────────────────────────────────────────────────────────────────
// Shared type contracts passed between agents
// ─────────────────────────────────────────────────────────────────

export type EnrichedItem = {
  name: string;
  category: 'Top' | 'Bottom' | 'Shoes' | 'Outerwear' | 'Accessory';
  primaryColor: string;
  secondaryColor: string | null;
  material: string;
  formality: number;       // 1–10
  season: 'Spring' | 'Summer' | 'Fall' | 'Winter' | 'All-Season';
};

export type StyleReport = {
  aesthetic: string;
  palette: string;
  occasion: string;
  priority: string;
  icon: string;
  formalityBias: number;       // 1–10, derived from occasion
  likedCategories: string[];   // from rated outfit history
  dislikedCategories: string[];
  avoidCombinations: string[]; // item combos thumbed-down by user
};

export type ContextReport = {
  weatherSummary: string;
  temp: number | null;
  trend: { headline: string; details: string };
  recommendedSeason: string;
  formalityAdjustment: number; // +/- modifier from weather
};

export type WeatherContext = {
  city: string;
  temp: number;
  feels_like: number;
  description: string;
} | null;
