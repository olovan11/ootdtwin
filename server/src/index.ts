import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import db from './db/setup';
import closetRouter from './routes/closet';
import analyzeRouter from './routes/analyze';
import profileRouter from './routes/profile';
import { getStylingAdvice, type WeatherContext } from './services/aiService';

const app = express();
const PORT = process.env.PORT || 3000;

// Lexington, VA — hardcoded for this app
const LEXINGTON_VA = { lat: 37.784, lon: -79.4428 };

app.use(cors());
app.use(express.json({ limit: '50mb' })); // large for video frames

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/closet',   closetRouter);
app.use('/api/analyze',  analyzeRouter);
app.use('/api/profile',  profileRouter);

// GET /api/health
app.get('/api/health', (_req, res) => {
  try {
    const row = db.prepare('SELECT 1 AS ok').get() as { ok: number };
    if (row.ok !== 1) throw new Error();
    res.json({ status: 'ok', db: 'connected', timestamp: new Date() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected', timestamp: new Date() });
  }
});

// GET /api/weather — always returns Lexington, VA conditions
app.get('/api/weather', async (_req, res) => {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key || key === 'your_key_here') {
    res.status(503).json({ error: 'Weather API key not configured' });
    return;
  }

  try {
    const { lat, lon } = LEXINGTON_VA;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=imperial`;
    const raw = await fetch(url);
    if (!raw.ok) throw new Error(`OpenWeatherMap ${raw.status}`);
    const data = await raw.json() as {
      name: string;
      main: { temp: number; feels_like: number };
      weather: { description: string; icon: string }[];
    };
    res.json({
      city: 'Lexington, VA',
      temp: Math.round(data.main.temp),
      feels_like: Math.round(data.main.feels_like),
      description: data.weather[0].description,
      icon: data.weather[0].icon,
    });
  } catch {
    res.status(502).json({ error: 'Failed to fetch weather' });
  }
});

// POST /api/recommend
app.post('/api/recommend', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'Anthropic API key not configured' });
    return;
  }

  const { weather } = req.body as { weather?: WeatherContext };

  try {
    const advice = await getStylingAdvice(weather ?? null);
    res.json({ advice });
  } catch (err) {
    console.error('AI service error:', err);
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
