# Bets Tracker

Node.js (Express 5) + PostgreSQL. O frontend é estático e é servido pelo próprio backend.

## Requisitos
- Node.js 20+
- PostgreSQL (local ou na cloud)

## Instalar e correr
    createdb bets                     # ou cria a base de dados no pgAdmin
    npm install
    npm run dev                       # http://localhost:3000  (usa --env-file=.env)

As tabelas são criadas automaticamente no arranque.
Em produção: `DATABASE_URL=... npm start` (ou usa pm2 para manter a app a correr).

## Backup
    pg_dump bets > bets.sql

## API
| Método | Rota | Descrição |
|---|---|---|
| GET | /api/bets?month=YYYY-MM | Lista apostas (com seleções) |
| POST | /api/bets | `{date, stake, status, legs:[{pick,match,sport,odd}]}` |
| PATCH | /api/bets/:id | `{status}` |
| DELETE | /api/bets/:id | Apaga aposta |
| GET | /api/stats?month=YYYY-MM | Profit, win rate, gráfico, por desporto/mês |

Com `APP_PASSWORD` definido a app pede password. Usa HTTPS se a puseres online.
