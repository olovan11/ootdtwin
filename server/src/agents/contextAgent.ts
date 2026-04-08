// ─────────────────────────────────────────────────────────────────
// Context Agent — weather + Spring 2026 trend layer
// Stateless: given a weather snapshot and the user's aesthetic,
// returns a ContextReport ready for the Outfit Agent.
// ─────────────────────────────────────────────────────────────────

import type { ContextReport, WeatherContext } from './types';

// Spring 2026 hardcoded trend report — updated each season
const SPRING_2026_TRENDS: Record<string, { headline: string; details: string }> = {
  Minimalist: {
    headline: 'Hyper-Functional Minimalism',
    details:
      'Clean silhouettes meet technical fabrications. Think tonal dressing with performance-material overtones — nothing decorative that isn\'t also useful. The quietest outfit in the room is the loudest statement.',
  },
  Classic: {
    headline: 'Old Money Revived',
    details:
      'Relaxed tailoring with a lived-in ease. Neutral palettes, natural fibres, and timeless cuts that never chase a trend. Tech-texture updates — lightweight merino, recycled oxford cloth — keep it relevant.',
  },
  Streetwear: {
    headline: 'Tech-Texture Layering',
    details:
      'Functional pockets, ripstop shells, and oversized proportions layered over clean base pieces. The silhouette is architectural; the palette is muted. Footwear stays technical and chunky.',
  },
  Bohemian: {
    headline: 'Modern Folk',
    details:
      'Earthy tones, flowing silhouettes, and artisan-inspired textures with subtle technical details — water-resistant linen, recycled cotton gauze. Effortlessly layered, never fussy.',
  },
  Preppy: {
    headline: 'Coastal Prep 2.0',
    details:
      'Nautical palettes and structured silhouettes updated with performance fabrications. Think weekend-on-the-water meets functional Ivy League — breathable, packable, polished.',
  },
  Bold: {
    headline: 'Maximalist Confidence',
    details:
      'Unapologetic colour-blocking, pattern mixing, and statement pieces in unexpected technical fabrics. The rule for Spring 2026: if you can feel it, wear it louder — and make sure it moves.',
  },
};

const DEFAULT_TREND = {
  headline: 'Effortless Personal Style',
  details:
    'Pieces that feel intentional and true to the wearer. Hyper-Functional Minimalism and Tech-Texture Layering are the macro forces of Spring 2026 — comfort, performance, and personality in equal measure.',
};

function currentSeason(): string {
  const m = new Date().getMonth(); // 0–11
  if (m >= 2 && m <= 4) return 'Spring';
  if (m >= 5 && m <= 7) return 'Summer';
  if (m >= 8 && m <= 10) return 'Fall';
  return 'Winter';
}

function formalityAdjustFromWeather(weather: WeatherContext): number {
  if (!weather) return 0;
  const desc = weather.description.toLowerCase();
  // Rain / snow / storms push toward practical layering (-1 formality)
  if (desc.includes('rain') || desc.includes('snow') || desc.includes('storm')) return -1;
  // Very hot → lighter, more casual
  if (weather.temp > 85) return -1;
  // Cold → incentivises structured outerwear (+1 formality)
  if (weather.temp < 45) return 1;
  return 0;
}

export function getContextReport(weather: WeatherContext, aesthetic: string): ContextReport {
  const trend              = SPRING_2026_TRENDS[aesthetic] ?? DEFAULT_TREND;
  const recommendedSeason  = currentSeason();
  const formalityAdjustment = formalityAdjustFromWeather(weather);

  const weatherSummary = weather
    ? `${weather.description}, ${weather.temp}°F (feels like ${weather.feels_like}°F) in ${weather.city}`
    : 'Weather unavailable — styling for a mild spring day.';

  return {
    weatherSummary,
    temp: weather?.temp ?? null,
    trend,
    recommendedSeason,
    formalityAdjustment,
  };
}
