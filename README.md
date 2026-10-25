# The Rolling Die — Inventory Web App + Discord Bot

Inventory system for The Rolling Die, a board game store and café.

- Public, read-only inventory page
- Manager area (login required) to add, edit and delete games
- Discord bot with slash commands (`/stock`, `/price`, `/game`) that read live data
- Live manager dashboard showing bot activity (socket.io)

Built with Node.js, Express, Mustache, SQLite, socket.io and discord.js.

## Setup

> Work in progress. Full setup steps will be added in the final milestone.

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the values
3. `npm start`, then open http://localhost:3000
