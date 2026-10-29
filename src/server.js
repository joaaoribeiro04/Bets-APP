import express from "express";
import helmet from "helmet";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { init, listBets, listMonths, createBet, setStatus, removeBet } from "./db.js";
import { computeStats } from "./stats.js";

const app = express();
app.use(helmet({ contentSecurityPolicy: { directives: { "script-src": ["'self'"], "script-src-attr": ["'none'"], "style-src": ["'self'", "'unsafe-inline'"] } } }));
app.use(express.json({ limit: "100kb" }));

// Autenticação opcional (HTTP Basic)
if (process.env.APP_PASSWORD) {
  app.use((req, res, next) => {
    const [, b64] = (req.headers.authorization || "").split(" ");
    const [, pass] = Buffer.from(b64 || "", "base64").toString().split(/:(.*)/s);
    if (pass === process.env.APP_PASSWORD) return next();
    res.set("WWW-Authenticate", 'Basic realm="Bets"').status(401).send("Autenticação necessária");
  });
}

const SPORTS = ["Futebol", "Ténis", "Basquetebol", "MMA/UFC", "Futsal", "Andebol", "Counter Strike 2", "Outros"];
const Status = z.enum(["pending", "won", "lost", "void"]);
const BetBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stake: z.number().positive().max(1_000_000),
  status: Status.default("pending"),
  legs: z.array(z.object({
    pick: z.string().trim().min(1).max(120),
    match: z.string().trim().max(160).default(""),
    sport: z.enum(SPORTS),
    odd: z.number().gt(1).max(10_000),
  })).min(1).max(30),
});
const Month = z.string().regex(/^\d{4}-\d{2}$/).optional();
const Id = z.coerce.number().int().positive();

const api = express.Router();
api.get("/meta", (_q, r) => r.json({ sports: SPORTS }));
api.get("/bets", async (q, r) => r.json(await listBets(Month.parse(q.query.month) ?? null)));
api.get("/stats", async (q, r) => {
  const month = Month.parse(q.query.month) ?? null;
  r.json({ ...computeStats(await listBets(month)), months: await listMonths() });
});
api.post("/bets", async (q, r) => r.status(201).json({ id: await createBet(BetBody.parse(q.body)) }));
api.patch("/bets/:id", async (q, r) => {
  const n = await setStatus(Id.parse(q.params.id), z.object({ status: Status }).parse(q.body).status);
  n ? r.json({ ok: true }) : r.status(404).json({ error: "Aposta não encontrada" });
});
api.delete("/bets/:id", async (q, r) => ((await removeBet(Id.parse(q.params.id))) ? r.status(204).end() : r.status(404).json({ error: "Aposta não encontrada" })));

app.use("/api", api);

app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public")));

app.use((err, _q, res, _n) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Dados inválidos", details: err.issues });
  console.error(err);
  res.status(500).json({ error: "Erro interno" });
});

await init();
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Bets a correr em http://localhost:${port}`));