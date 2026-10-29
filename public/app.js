const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const eur = (n) => n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "€";
const sg = (n) => (n > 0 ? "+" : "") + eur(n);
const cls = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "");
const mes = (m) => { const [y, mo] = m.split("-"); const n = new Date(+y, +mo - 1, 1).toLocaleDateString("pt-PT", { month: "long" }); return n[0].toUpperCase() + n.slice(1) + " " + y; };
const EMOJI = { "Futebol": "⚽", "Ténis": "🎾", "Basquetebol": "🏀", "Futsal": "🥅", "Andebol": "🤾", "Counter Strike 2": "🔫", "MMA/UFC": "🥊", "Outros": "🎲", "Mistas": "🔀" };
const LBL = { won: "Ganho", lost: "Perdido", pending: "Pendente", void: "Anulada" };
const NEXT = { pending: "won", won: "lost", lost: "void", void: "pending" };
let sports = [], view = "bySport", stats = null;

async function api(path, opts = {}) {
  const r = await fetch("/api" + path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Erro " + r.status);
  return r.status === 204 ? null : r.json();
}
const q = () => ($("fm").value ? "?month=" + $("fm").value : "");

async function load() {
  const [s, bets] = await Promise.all([api("/stats" + q()), api("/bets" + q())]);
  stats = s;
  const cur = $("fm").value;
  $("fm").innerHTML = '<option value="">Todos os meses</option>' + s.months.map((m) => `<option value="${m}">${mes(m)}</option>`).join("");
  $("fm").value = s.months.includes(cur) ? cur : "";
  renderStats(s); renderPerf(); renderList(bets);
}

function renderStats(s) {
  $("profit").textContent = sg(s.profit);
  $("profit").className = "big " + cls(s.profit);
  $("stats").innerHTML = `<div><small>Win rate</small><b>${(s.winRate * 100).toFixed(1)}%</b></div>
   <div><small>Total apostado</small><b>${eur(s.stake)}</b></div><div><small>Total ganho</small><b>${eur(s.returned)}</b></div>
   <div><small>Ganhas / Perdidas</small><b><span class="pos">${s.won}</span> / <span class="neg">${s.lost}</span></b><small>${s.void} anuladas · ${s.pending} pendentes</small></div>`;
  const v = [0, ...s.series.map((p) => p.profit)];
  if (v.length < 2) { $("chart").innerHTML = ""; return; }
  const mn = Math.min(...v), rg = Math.max(...v) - mn || 1, n = v.length - 1;
  const pts = v.map((y, i) => `${(i / n) * 600},${110 - ((y - mn) / rg) * 100}`).join(" ");
  const c = s.profit >= 0 ? "var(--g)" : "var(--r)";
  $("chart").innerHTML = `<polygon points="0,120 ${pts} 600,120" fill="${c}" opacity=".12"/><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
}

function renderPerf() {
  const rows = stats[view];
  $("perf").innerHTML = `<tr><th>${view === "bySport" ? "Desporto" : "Mês"}</th><th>Apostas</th><th>G / P</th><th>Win rate</th><th>Apostado</th><th>Profit</th><th>ROI</th></tr>` +
    (rows.map((o) => `<tr><td>${view === "byMonth" ? esc(mes(o.key)) : (EMOJI[o.key] || "🏅") + " " + esc(o.key)}</td><td>${o.bets}</td><td><span class="pos">${o.won}</span> / <span class="neg">${o.lost}</span></td><td>${Math.round(o.winRate * 100)}%</td><td>${eur(o.stake)}</td><td class="${cls(o.profit)}">${sg(o.profit)}</td><td class="${cls(o.profit)}">${(o.roi * 100).toFixed(1)}%</td></tr>`).join("") || '<tr><td colspan="7" class="empty">Sem apostas resolvidas.</td></tr>');
}

function renderList(bets) {
  $("list").innerHTML = bets.length ? bets.map((b) => {
    const odd = b.legs.reduce((a, l) => a * l.odd, 1), pot = b.stake * odd;
    return `<div class="bet ${b.status}"><div class="bh"><div><b>${b.legs.length > 1 ? `Múltipla (${b.legs.length})` : "Simples"}</b><span class="d">${b.date.split("-").reverse().join("-")}</span></div>
     <div><button class="tag" data-st="${b.id}" data-cur="${b.status}" title="Mudar resultado">${LBL[b.status]}</button><button class="del" data-del="${b.id}" aria-label="Apagar">✕</button></div></div>
     ${b.legs.map((l) => `<div class="leg"><div><b>${esc(l.pick)}</b><small>${esc(l.match)} · ${esc(l.sport)}</small></div><div class="odd"><small>Odd</small>${l.odd.toFixed(2)}</div></div>`).join("")}
     <div class="bf"><div><small>Odd total</small><b>${odd.toFixed(2)}</b></div><div><small>Valor apostado</small><b>${eur(b.stake)}</b></div>
     <div><small>${b.status === "won" ? "Ganho" : b.status === "lost" ? "Perda" : "Ganho potencial"}</small><b class="${b.status === "won" ? "pos" : b.status === "lost" ? "neg" : ""}">${eur(b.status === "lost" ? b.stake : pot)}</b></div></div></div>`;
  }).join("") : '<div class="card empty">Ainda não há apostas. Carrega em “Nova aposta” para começar.</div>';
}

function legRow() {
  const d = document.createElement("div"); d.className = "lg";
  d.innerHTML = `<input class="p" placeholder="Seleção" required><input class="m" placeholder="Jogo"><select class="s">${sports.map((s) => `<option>${esc(s)}</option>`).join("")}</select><input class="o" type="number" step="0.01" min="1.01" placeholder="Odd" required><button type="button" class="del" aria-label="Remover">✕</button>`;
  d.querySelector("button").onclick = () => { if ($("legs").children.length > 1) { d.remove(); tot(); } };
  d.querySelector(".o").oninput = tot; $("legs").appendChild(d);
}
const tot = () => ($("ft").value = [...document.querySelectorAll(".lg .o")].reduce((a, i) => a * (+i.value || 1), 1).toFixed(2));

$("new").onclick = () => { $("legs").innerHTML = ""; legRow(); $("fd").value = new Date().toISOString().slice(0, 10); $("fs").value = ""; $("fr").value = "pending"; $("err").textContent = ""; tot(); $("dlg").showModal(); };
$("addleg").onclick = legRow; $("cx").onclick = () => $("dlg").close();
$("f").onsubmit = async (e) => {
  e.preventDefault();
  const legs = [...document.querySelectorAll(".lg")].map((r) => ({ pick: r.querySelector(".p").value, match: r.querySelector(".m").value, sport: r.querySelector(".s").value, odd: +r.querySelector(".o").value }));
  try { await api("/bets", { method: "POST", body: JSON.stringify({ date: $("fd").value, stake: +$("fs").value, status: $("fr").value, legs }) }); $("dlg").close(); await load(); }
  catch (x) { $("err").textContent = x.message; }
};
$("list").onclick = async (e) => {
  const t = e.target;
  try {
    if (t.dataset.st) { await api("/bets/" + t.dataset.st, { method: "PATCH", body: JSON.stringify({ status: NEXT[t.dataset.cur] }) }); await load(); }
    if (t.dataset.del && confirm("Apagar esta aposta?")) { await api("/bets/" + t.dataset.del, { method: "DELETE" }); await load(); }
  } catch (x) { alert(x.message); }
};
$("fm").onchange = load;
for (const k of ["bySport", "byMonth"]) $(k).onclick = () => { view = k; $("bySport").classList.toggle("on", k === "bySport"); $("byMonth").classList.toggle("on", k === "byMonth"); renderPerf(); };

api("/meta").then((m) => { sports = m.sports; return load(); }).catch((x) => ($("list").innerHTML = `<div class="card empty">${esc(x.message)}</div>`));