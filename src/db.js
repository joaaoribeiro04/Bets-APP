import pg from "pg";

// NUMERIC -> number e DATE -> "YYYY-MM-DD" (em vez de Date)
pg.types.setTypeParser(1700, parseFloat);
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

export async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bets (
      id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      date       DATE NOT NULL,
      stake      NUMERIC(12,2) NOT NULL CHECK (stake > 0),
      status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost','void')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS legs (
      id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      bet_id INTEGER NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
      pick   TEXT NOT NULL,
      match  TEXT NOT NULL DEFAULT '',
      sport  TEXT NOT NULL,
      odd    NUMERIC(10,2) NOT NULL CHECK (odd > 1)
    );
    CREATE INDEX IF NOT EXISTS idx_bets_date ON bets(date);
    CREATE INDEX IF NOT EXISTS idx_legs_bet ON legs(bet_id);
  `);
}

export async function listBets(month = null) {
  const { rows } = await pool.query(
    `SELECT b.id, b.date, b.stake, b.status,
            COALESCE(json_agg(json_build_object('id', l.id, 'pick', l.pick, 'match', l.match, 'sport', l.sport, 'odd', l.odd)
                     ORDER BY l.id) FILTER (WHERE l.id IS NOT NULL), '[]') AS legs
       FROM bets b LEFT JOIN legs l ON l.bet_id = b.id
      WHERE ($1::text IS NULL OR to_char(b.date, 'YYYY-MM') = $1)
      GROUP BY b.id
      ORDER BY b.date DESC, b.id DESC`,
    [month]
  );
  return rows;
}

export async function listMonths() {
  const { rows } = await pool.query("SELECT DISTINCT to_char(date, 'YYYY-MM') AS m FROM bets ORDER BY m DESC");
  return rows.map((r) => r.m);
}

export async function createBet({ date, stake, status, legs }) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query("INSERT INTO bets (date, stake, status) VALUES ($1,$2,$3) RETURNING id", [date, stake, status]);
    for (const l of legs)
      await c.query("INSERT INTO legs (bet_id, pick, match, sport, odd) VALUES ($1,$2,$3,$4,$5)", [rows[0].id, l.pick, l.match, l.sport, l.odd]);
    await c.query("COMMIT");
    return rows[0].id;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export const setStatus = async (id, status) => (await pool.query("UPDATE bets SET status=$1 WHERE id=$2", [status, id])).rowCount;
export const removeBet = async (id) => (await pool.query("DELETE FROM bets WHERE id=$1", [id])).rowCount;