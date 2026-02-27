/**
 * index.js - CircleBeats Colyseus server entry point.
 *
 * Starts an Express + Colyseus server on the configured port (default 2567).
 * Registers the "rhythm_room" room type used by the CircleBeats client.
 */

require("dotenv").config();

const http = require("http");
const express = require("express");
const { Server } = require("@colyseus/core");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { RhythmRoom } = require("./rooms/RhythmRoom");

const PORT = parseInt(process.env.PORT, 10) || 2567;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

const httpServer = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// Register the room type.
// Client calls: client.joinOrCreate("rhythm_room", options)
gameServer.define("rhythm_room", RhythmRoom);

httpServer.listen(PORT, HOST, () => {
  console.log(`[CircleBeats] Colyseus server listening on ${HOST}:${PORT}`);
  console.log(`[CircleBeats] Health check: http://${HOST}:${PORT}/health`);
});
