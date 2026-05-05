require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const { pool, initSchema } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://silkroadcalc.eu',
    'https://www.silkroadcalc.eu',
    'https://admin.silkroadcalc.eu',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:3000',
  ]
}));
app.use(express.json());
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.get('/health', (_req, res) => res.json({ ok: true }));

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try { jwt.verify(auth.slice(7), process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

const err = (res, e) => { console.error(e); res.status(500).json({ error: 'DB error' }); };

// ── Public ────────────────────────────────────────────────────────────────────

app.get('/api/goods', async (_req, res) => {
  try {
    const [gRes, pRes] = await Promise.all([
      pool.query('SELECT name, base_price, type, hop_pct FROM goods ORDER BY type, name'),
      pool.query('SELECT city_name, good_name FROM city_goods'),
    ]);
    const produced = {};
    for (const r of pRes.rows) {
      if (!produced[r.good_name]) produced[r.good_name] = [];
      produced[r.good_name].push(r.city_name);
    }
    res.json(gRes.rows.map(r => ({
      name: r.name, base_price: r.base_price, type: r.type, hop_pct: r.hop_pct,
      produced_in: produced[r.name] || [],
    })));
  } catch (e) { err(res, e); }
});

app.get('/api/travel-times', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT from_city, to_city, minutes FROM travel_times');
    const m = {};
    for (const r of rows) { if (!m[r.from_city]) m[r.from_city] = {}; m[r.from_city][r.to_city] = r.minutes; }
    res.json(m);
  } catch (e) { err(res, e); }
});

app.get('/api/cities', async (_req, res) => {
  try {
    const [cRes, tRes, gRes] = await Promise.all([
      pool.query('SELECT * FROM cities ORDER BY name'),
      pool.query('SELECT city_name, trait_name FROM city_city_traits'),
      pool.query('SELECT city_name, good_name FROM city_goods'),
    ]);
    res.json(cRes.rows.map(c => ({
      name: c.name, culture: c.culture, language: c.language, has_fire_temple: c.has_fire_temple,
      traits:   tRes.rows.filter(r => r.city_name === c.name).map(r => r.trait_name),
      produced: gRes.rows.filter(r => r.city_name === c.name).map(r => r.good_name),
    })));
  } catch (e) { err(res, e); }
});

app.get('/api/cities/traits', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT name, description FROM city_traits ORDER BY name');
    res.json(rows);
  } catch (e) { err(res, e); }
});

app.get('/api/events', async (_req, res) => {
  try {
    const [etRes, elRes] = await Promise.all([
      pool.query('SELECT * FROM event_types ORDER BY name'),
      pool.query('SELECT * FROM event_levels ORDER BY event_name, level'),
    ]);
    res.json(etRes.rows.map(e => ({
      name: e.name, glyph: e.glyph, dir: e.dir,
      good_types: e.good_types, good_names: e.good_names, description: e.description,
      levels: elRes.rows.filter(l => l.event_name === e.name),
    })));
  } catch (e) { err(res, e); }
});

app.get('/api/events/:name/levels', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM event_levels WHERE event_name=$1 ORDER BY level',
      [decodeURIComponent(req.params.name)]);
    res.json(rows);
  } catch (e) { err(res, e); }
});

app.get('/api/religions', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT name FROM religions ORDER BY name');
    res.json(rows);
  } catch (e) { err(res, e); }
});

app.get('/api/religion-perks', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM religion_perks ORDER BY religion, min_level');
    res.json(rows);
  } catch (e) { err(res, e); }
});

app.get('/api/trait-effects', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM trait_effects ORDER BY trait_name');
    res.json(rows);
  } catch (e) { err(res, e); }
});

app.get('/api/languages', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT name FROM languages ORDER BY name');
    res.json(rows);
  } catch (e) { err(res, e); }
});

app.get('/api/maintenance', async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key='maintenance'`);
    const data = rows.length ? JSON.parse(rows[0].value) : { active: false, message: '' };
    res.json(data);
  } catch (e) { err(res, e); }
});

app.get('/api/changelogs', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM changelogs ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { err(res, e); }
});

app.post('/api/session/ping', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 64)
    return res.status(400).json({ error: 'Invalid sessionId' });
  try {
    await pool.query(
      `INSERT INTO sessions (session_id, last_ping, created_at) VALUES ($1, NOW(), NOW())
       ON CONFLICT (session_id) DO UPDATE SET last_ping = NOW()`, [sessionId]);
    await pool.query(
      `INSERT INTO daily_sessions (date, session_id) VALUES (CURRENT_DATE, $1) ON CONFLICT DO NOTHING`, [sessionId]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
  if (!req.body.password || req.body.password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Wrong password' });
  res.json({ token: jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '7d' }) });
});

// ── Analytics ─────────────────────────────────────────────────────────────────

app.get('/api/analytics', requireAdmin, async (_req, res) => {
  try {
    const [a, b, c] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM sessions WHERE last_ping > NOW() - INTERVAL '5 minutes'`),
      pool.query(`SELECT COUNT(*) FROM daily_sessions WHERE date = CURRENT_DATE`),
      pool.query(`SELECT date, COUNT(*) AS visits FROM daily_sessions WHERE date >= CURRENT_DATE - INTERVAL '6 days' GROUP BY date ORDER BY date`),
    ]);
    res.json({ onlineNow: parseInt(a.rows[0].count), todayVisits: parseInt(b.rows[0].count),
      last7Days: c.rows.map(r => ({ date: r.date, visits: parseInt(r.visits) })) });
  } catch (e) { err(res, e); }
});

// ── Goods ─────────────────────────────────────────────────────────────────────

app.post('/api/admin/goods', requireAdmin, async (req, res) => {
  const { name, base_price, type, hop_pct } = req.body;
  if (!name || !base_price || !type || hop_pct == null) return res.status(400).json({ error: 'Missing fields' });
  try {
    await pool.query(`INSERT INTO goods (name,base_price,type,hop_pct) VALUES ($1,$2,$3,$4)`,
      [name, base_price, type, hop_pct]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.patch('/api/admin/goods/:name', requireAdmin, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const { base_price, type, hop_pct } = req.body;
  try {
    await pool.query(
      `UPDATE goods SET base_price=COALESCE($1,base_price), type=COALESCE($2,type), hop_pct=COALESCE($3,hop_pct) WHERE name=$4`,
      [base_price ?? null, type ?? null, hop_pct ?? null, name]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/goods/:name', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM goods WHERE name=$1', [decodeURIComponent(req.params.name)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.post('/api/admin/goods/:name/cities', requireAdmin, async (req, res) => {
  try {
    await pool.query(`INSERT INTO city_goods (city_name,good_name) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.body.city_name, decodeURIComponent(req.params.name)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/goods/:name/cities/:city', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM city_goods WHERE good_name=$1 AND city_name=$2',
      [decodeURIComponent(req.params.name), decodeURIComponent(req.params.city)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

// ── Travel times ──────────────────────────────────────────────────────────────

app.put('/api/admin/travel-times', requireAdmin, async (req, res) => {
  const { from_city, to_city, minutes } = req.body;
  if (!from_city || !to_city || typeof minutes !== 'number' || minutes <= 0)
    return res.status(400).json({ error: 'Invalid data' });
  try {
    await pool.query(`INSERT INTO travel_times (from_city,to_city,minutes) VALUES ($1,$2,$3) ON CONFLICT (from_city,to_city) DO UPDATE SET minutes=$3`, [from_city, to_city, minutes]);
    await pool.query(`INSERT INTO travel_times (from_city,to_city,minutes) VALUES ($2,$1,$3) ON CONFLICT (from_city,to_city) DO UPDATE SET minutes=$3`, [from_city, to_city, minutes]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

// ── Cities ────────────────────────────────────────────────────────────────────

app.post('/api/admin/cities', requireAdmin, async (req, res) => {
  const { name, culture, language, has_fire_temple } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  try {
    await pool.query(`INSERT INTO cities (name,culture,language,has_fire_temple) VALUES ($1,$2,$3,$4)`,
      [name, culture || '', language || '', has_fire_temple || false]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.patch('/api/admin/cities/:name', requireAdmin, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const { culture, language, has_fire_temple } = req.body;
  try {
    await pool.query(
      `UPDATE cities SET culture=COALESCE($1,culture), language=COALESCE($2,language), has_fire_temple=COALESCE($3,has_fire_temple) WHERE name=$4`,
      [culture ?? null, language ?? null, has_fire_temple ?? null, name]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/cities/:name', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM cities WHERE name=$1', [decodeURIComponent(req.params.name)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.post('/api/admin/cities/:name/traits', requireAdmin, async (req, res) => {
  try {
    await pool.query(`INSERT INTO city_city_traits (city_name,trait_name) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [decodeURIComponent(req.params.name), req.body.trait_name]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/cities/:name/traits/:trait', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM city_city_traits WHERE city_name=$1 AND trait_name=$2',
      [decodeURIComponent(req.params.name), decodeURIComponent(req.params.trait)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.post('/api/admin/cities/:name/goods', requireAdmin, async (req, res) => {
  try {
    await pool.query(`INSERT INTO city_goods (city_name,good_name) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [decodeURIComponent(req.params.name), req.body.good_name]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/cities/:name/goods/:good', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM city_goods WHERE city_name=$1 AND good_name=$2',
      [decodeURIComponent(req.params.name), decodeURIComponent(req.params.good)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

// ── Traits ────────────────────────────────────────────────────────────────────

app.post('/api/admin/traits', requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  try {
    await pool.query(`INSERT INTO city_traits (name,description) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [name, description || '']);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.patch('/api/admin/traits/:name', requireAdmin, async (req, res) => {
  try {
    await pool.query(`UPDATE city_traits SET description=COALESCE($1,description) WHERE name=$2`,
      [req.body.description ?? null, decodeURIComponent(req.params.name)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/traits/:name', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM city_traits WHERE name=$1', [decodeURIComponent(req.params.name)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.post('/api/admin/trait-effects', requireAdmin, async (req, res) => {
  const { trait_name, kind, bonus, cond_type, cond_value } = req.body;
  if (!trait_name || bonus == null) return res.status(400).json({ error: 'Missing fields' });
  try {
    await pool.query(`INSERT INTO trait_effects (trait_name,kind,bonus,cond_type,cond_value) VALUES ($1,$2,$3,$4,$5)`,
      [trait_name, kind || null, bonus, cond_type || null, cond_value || null]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.patch('/api/admin/trait-effects/:id', requireAdmin, async (req, res) => {
  const { kind, bonus, cond_type, cond_value } = req.body;
  try {
    await pool.query(
      `UPDATE trait_effects SET kind=COALESCE($1,kind), bonus=COALESCE($2,bonus), cond_type=COALESCE($3,cond_type), cond_value=COALESCE($4,cond_value) WHERE id=$5`,
      [kind ?? null, bonus ?? null, cond_type ?? null, cond_value ?? null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/trait-effects/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM trait_effects WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

// ── Languages ─────────────────────────────────────────────────────────────────

app.post('/api/admin/languages', requireAdmin, async (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: 'Missing name' });
  try {
    await pool.query(`INSERT INTO languages (name) VALUES ($1) ON CONFLICT DO NOTHING`, [req.body.name]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/languages/:name', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM languages WHERE name=$1', [decodeURIComponent(req.params.name)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

// ── Religions ─────────────────────────────────────────────────────────────────

app.post('/api/admin/religions', requireAdmin, async (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: 'Missing name' });
  try {
    await pool.query(`INSERT INTO religions (name) VALUES ($1) ON CONFLICT DO NOTHING`, [req.body.name]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/religions/:name', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM religions WHERE name=$1', [decodeURIComponent(req.params.name)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.post('/api/admin/religion-perks', requireAdmin, async (req, res) => {
  const { religion, min_level, perk_type, multiplier, description } = req.body;
  if (!religion || !min_level || !perk_type || multiplier == null) return res.status(400).json({ error: 'Missing fields' });
  try {
    await pool.query(`INSERT INTO religion_perks (religion,min_level,perk_type,multiplier,description) VALUES ($1,$2,$3,$4,$5)`,
      [religion, min_level, perk_type, multiplier, description || '']);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.patch('/api/admin/religion-perks/:id', requireAdmin, async (req, res) => {
  const { min_level, perk_type, multiplier, description } = req.body;
  try {
    await pool.query(
      `UPDATE religion_perks SET min_level=COALESCE($1,min_level), perk_type=COALESCE($2,perk_type), multiplier=COALESCE($3,multiplier), description=COALESCE($4,description) WHERE id=$5`,
      [min_level ?? null, perk_type ?? null, multiplier ?? null, description ?? null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/religion-perks/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM religion_perks WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

// ── Maintenance & Changelogs ──────────────────────────────────────────────────

app.post('/api/admin/maintenance', requireAdmin, async (req, res) => {
  const { active, message } = req.body;
  try {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('maintenance', $1)
       ON CONFLICT (key) DO UPDATE SET value=$1`,
      [JSON.stringify({ active: !!active, message: message || '' })]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.post('/api/admin/changelogs', requireAdmin, async (req, res) => {
  const { version, date, entries, thanks } = req.body;
  if (!version) return res.status(400).json({ error: 'Missing version' });
  try {
    await pool.query(
      `INSERT INTO changelogs (version,date,entries,thanks) VALUES ($1,$2,$3,$4)`,
      [version, date || new Date().toISOString().slice(0,10), entries || [], thanks || '']);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.patch('/api/admin/changelogs/:id', requireAdmin, async (req, res) => {
  const { version, date, entries, thanks } = req.body;
  try {
    await pool.query(
      `UPDATE changelogs SET version=COALESCE($1,version), date=COALESCE($2,date), entries=COALESCE($3,entries), thanks=COALESCE($4,thanks) WHERE id=$5`,
      [version ?? null, date ?? null, entries ?? null, thanks ?? null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/changelogs/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM changelogs WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

// ── Events ────────────────────────────────────────────────────────────────────

app.post('/api/admin/events', requireAdmin, async (req, res) => {
  const { name, glyph, dir, good_types, good_names, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  try {
    await pool.query(`INSERT INTO event_types (name,glyph,dir,good_types,good_names,description) VALUES ($1,$2,$3,$4,$5,$6)`,
      [name, glyph || '', dir ?? 1, good_types || [], good_names || [], description || '']);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.patch('/api/admin/events/:name', requireAdmin, async (req, res) => {
  const { glyph, dir, good_types, good_names, description } = req.body;
  try {
    await pool.query(
      `UPDATE event_types SET glyph=COALESCE($1,glyph), dir=COALESCE($2,dir), good_types=COALESCE($3,good_types), good_names=COALESCE($4,good_names), description=COALESCE($5,description) WHERE name=$6`,
      [glyph ?? null, dir ?? null, good_types ?? null, good_names ?? null, description ?? null, decodeURIComponent(req.params.name)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/events/:name', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM event_types WHERE name=$1', [decodeURIComponent(req.params.name)]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.post('/api/admin/events/:name/levels', requireAdmin, async (req, res) => {
  const { level, pct, base_bonus, label } = req.body;
  if (!level || pct == null) return res.status(400).json({ error: 'Missing fields' });
  try {
    await pool.query(
      `INSERT INTO event_levels (event_name,level,pct,base_bonus,label) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (event_name,level) DO UPDATE SET pct=$3, base_bonus=$4, label=$5`,
      [decodeURIComponent(req.params.name), level, pct, base_bonus ?? 0, label || '']);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.patch('/api/admin/events/levels/:id', requireAdmin, async (req, res) => {
  const { label, pct, base_bonus } = req.body;
  try {
    await pool.query(
      `UPDATE event_levels SET label=COALESCE($1,label), pct=COALESCE($2,pct), base_bonus=COALESCE($3,base_bonus) WHERE id=$4`,
      [label ?? null, pct ?? null, base_bonus ?? null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

app.delete('/api/admin/events/levels/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM event_levels WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

// ─────────────────────────────────────────────────────────────────────────────

initSchema()
  .then(() => app.listen(PORT, () => console.log(`Listening on port ${PORT}`)))
  .catch(e => { console.error('Schema init failed:', e); process.exit(1); });
