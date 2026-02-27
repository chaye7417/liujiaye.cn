/**
 * RhythmRoom.js - Colyseus room for CircleBeats real-time collaboration.
 *
 * Manages 8 instrument slots, rhythm pattern data, synth parameters, BPM,
 * base-note (octave) info, and heartbeat keep-alive.
 *
 * All message types are designed to be fully compatible with the existing
 * client code in partySyncColyseus.js (colyseus.js@0.15.12).
 */

const colyseus = require("@colyseus/core");
const { RhythmState, SlotInfo } = require("../schema/RhythmState");

/** How often the server sends a heartbeat ping (ms). */
const HEARTBEAT_INTERVAL_MS = 15_000;

/** Maximum number of instrument slots. */
const MAX_SLOTS = 8;

/** Maximum clients allowed in one room. */
const MAX_CLIENTS = 16;

class RhythmRoom extends colyseus.Room {

  // ─── lifecycle ─────────────────────────────────────────────────────

  onCreate(options) {
    this.maxClients = MAX_CLIENTS;
    this.setState(new RhythmState());

    // Optionally override room name from client options
    if (options && options.roomName) {
      this.state.roomName = options.roomName;
    }

    // Internal bookkeeping: sessionId -> Set<slotIndex>
    this._clientSlots = new Map();

    // Start heartbeat loop
    this._heartbeatInterval = this.clock.setInterval(() => {
      this._sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    this._registerMessageHandlers();

    console.log(`[RhythmRoom] Room created: ${this.state.roomName}`);
  }

  onJoin(client, options) {
    const username = (options && options.username) || `user_${client.sessionId.slice(0, 6)}`;
    this._clientSlots.set(client.sessionId, new Set());

    console.log(`[RhythmRoom] Client joined: ${client.sessionId} (${username})`);

    // Send welcome message (client expects this format)
    client.send("welcome", {
      success: true,
      status: "connected",
      roomName: this.state.roomName,
      sessionId: client.sessionId,
      message: "Connected to CircleBeats server",
      connectedClients: this.clients.length,
      maxClients: this.maxClients,
    });

    // Notify other clients
    this.broadcast("userJoined", {
      sessionId: client.sessionId,
      username,
      connectedClients: this.clients.length,
      timestamp: Date.now(),
    }, { except: client });
  }

  onLeave(client, consented) {
    console.log(`[RhythmRoom] Client left: ${client.sessionId} (consented=${consented})`);

    // Release all slots held by this client
    const releasedSlots = this._releaseAllSlots(client.sessionId);

    // Remove bookkeeping entry
    this._clientSlots.delete(client.sessionId);

    // Notify remaining clients
    this.broadcast("userLeft", {
      sessionId: client.sessionId,
      connectedClients: this.clients.length,
      releasedSlots,
      timestamp: Date.now(),
    });

    // Broadcast updated slot info
    if (releasedSlots.length > 0) {
      this._broadcastSlotsInfo(releasedSlots);
    }
  }

  onDispose() {
    console.log("[RhythmRoom] Room disposed");
  }

  // ─── message handlers ──────────────────────────────────────────────

  _registerMessageHandlers() {

    // --- heartbeat ---
    this.onMessage("heartbeat_response", (client, data) => {
      // Client responded to our heartbeat; nothing special needed.
    });

    // --- slot management ---

    this.onMessage("claimSlot", (client, data) => {
      this._handleClaimSlot(client, data);
    });

    this.onMessage("selectSlot", (client, data) => {
      // Alias used in some client code paths
      this._handleClaimSlot(client, data);
    });

    this.onMessage("releaseSlot", (client, data) => {
      this._handleReleaseSlot(client, data);
    });

    // --- preset / pattern data ---

    this.onMessage("updatePreset", (client, data) => {
      this._handleUpdatePreset(client, data);
    });

    // --- synth parameters ---

    this.onMessage("updateSynthParams", (client, data) => {
      this._handleUpdateSynthParams(client, data);
    });

    // --- BPM ---

    this.onMessage("updateBpm", (client, data) => {
      this._handleUpdateBpm(client, data);
    });

    // --- base note (octave) ---

    this.onMessage("updateBaseNote", (client, data) => {
      this._handleUpdateBaseNote(client, data);
    });

    // --- initial state request ---

    this.onMessage("requestInitialState", (client) => {
      this._sendInitialState(client);
    });

    // --- room state request (used when opening slot dialog) ---

    this.onMessage("requestRoomState", (client) => {
      this._sendRoomState(client);
    });

    // --- syncNow (client confirmation ping) ---

    this.onMessage("syncNow", (client, data) => {
      client.send("syncNowResponse", {
        success: true,
        timestamp: Date.now(),
        slotIndex: data && data.slotIndex,
      });
    });
  }

  // ─── slot claim / release ──────────────────────────────────────────

  _handleClaimSlot(client, data) {
    const slotIndex = data && data.slotIndex;
    const username = (data && data.username) || `user_${client.sessionId.slice(0, 6)}`;

    if (typeof slotIndex !== "number" || slotIndex < 0 || slotIndex >= MAX_SLOTS) {
      client.send("slotClaimResponse", {
        success: false,
        slotIndex,
        message: `Invalid slot index: ${slotIndex}`,
      });
      return;
    }

    // Check if slot is already occupied by someone else
    const existing = this.state.slots.get(String(slotIndex));
    if (existing && existing.sessionId && existing.sessionId !== client.sessionId) {
      client.send("slotClaimResponse", {
        success: false,
        slotIndex,
        message: `Slot ${slotIndex + 1} is already occupied`,
      });
      return;
    }

    // Claim the slot
    const slotInfo = new SlotInfo();
    slotInfo.sessionId = client.sessionId;
    slotInfo.username = username;
    this.state.slots.set(String(slotIndex), slotInfo);

    // Track in internal map
    const owned = this._clientSlots.get(client.sessionId);
    if (owned) owned.add(slotIndex);

    console.log(`[RhythmRoom] Slot ${slotIndex} claimed by ${client.sessionId} (${username})`);

    client.send("slotClaimResponse", {
      success: true,
      slotIndex,
      message: `Claimed slot ${slotIndex + 1}`,
    });

    // Broadcast updated slot info to all clients
    this._broadcastSlotsInfo();
  }

  _handleReleaseSlot(client, data) {
    const slotIndex = data && data.slotIndex;

    if (typeof slotIndex !== "number" || slotIndex < 0 || slotIndex >= MAX_SLOTS) {
      client.send("slotReleaseResponse", {
        success: false,
        slotIndex,
        message: `Invalid slot index: ${slotIndex}`,
      });
      return;
    }

    // Only the owner may release a slot
    const existing = this.state.slots.get(String(slotIndex));
    if (!existing || existing.sessionId !== client.sessionId) {
      client.send("slotReleaseResponse", {
        success: false,
        slotIndex,
        message: `You do not own slot ${slotIndex + 1}`,
      });
      return;
    }

    // Release the slot
    this.state.slots.delete(String(slotIndex));

    // Clear associated data
    this.state.presets.delete(String(slotIndex));
    this.state.synthParams.delete(String(slotIndex));
    this.state.baseNotes.delete(String(slotIndex));

    // Track in internal map
    const owned = this._clientSlots.get(client.sessionId);
    if (owned) owned.delete(slotIndex);

    console.log(`[RhythmRoom] Slot ${slotIndex} released by ${client.sessionId}`);

    client.send("slotReleaseResponse", {
      success: true,
      slotIndex,
      message: `Released slot ${slotIndex + 1}`,
    });

    // Broadcast updated slot info with released-slot indicator
    this._broadcastSlotsInfo([slotIndex]);
  }

  /**
   * Release all slots held by a given session (used on disconnect).
   * Returns an array of released slot indices.
   */
  _releaseAllSlots(sessionId) {
    const released = [];
    const owned = this._clientSlots.get(sessionId);
    if (!owned) return released;

    for (const slotIndex of owned) {
      const existing = this.state.slots.get(String(slotIndex));
      if (existing && existing.sessionId === sessionId) {
        this.state.slots.delete(String(slotIndex));
        this.state.presets.delete(String(slotIndex));
        this.state.synthParams.delete(String(slotIndex));
        this.state.baseNotes.delete(String(slotIndex));
        released.push(slotIndex);
        console.log(`[RhythmRoom] Slot ${slotIndex} auto-released (disconnect)`);
      }
    }
    owned.clear();
    return released;
  }

  // ─── preset / pattern ──────────────────────────────────────────────

  _handleUpdatePreset(client, data) {
    const { slotIndex, preset } = data || {};
    if (typeof slotIndex !== "number" || slotIndex < 0 || slotIndex >= MAX_SLOTS) return;
    if (!this._ownsSlot(client.sessionId, slotIndex)) return;

    // Store preset data (JSON string)
    const presetStr = typeof preset === "string" ? preset : JSON.stringify(preset);
    this.state.presets.set(String(slotIndex), presetStr);

    // Broadcast to other clients
    this.broadcast("presetUpdated", {
      slotIndex,
      preset: presetStr,
      timestamp: data.timestamp || Date.now(),
      priority: data.priority || "normal",
    }, { except: client });
  }

  // ─── synth parameters ──────────────────────────────────────────────

  _handleUpdateSynthParams(client, data) {
    const { slotIndex, params } = data || {};
    if (typeof slotIndex !== "number" || slotIndex < 0 || slotIndex >= MAX_SLOTS) return;
    if (!this._ownsSlot(client.sessionId, slotIndex)) return;

    // Store synth params (JSON string)
    const paramsStr = typeof params === "string" ? params : JSON.stringify(params);
    this.state.synthParams.set(String(slotIndex), paramsStr);

    // Broadcast to other clients
    this.broadcast("synthParamsUpdated", {
      slotIndex,
      params: paramsStr,
      timestamp: Date.now(),
    }, { except: client });
  }

  // ─── BPM ───────────────────────────────────────────────────────────

  _handleUpdateBpm(client, data) {
    const bpm = data && data.bpm;
    if (typeof bpm !== "number" || bpm < 30 || bpm > 300) return;

    this.state.bpm = bpm;

    // Broadcast to other clients
    this.broadcast("bpmUpdated", {
      bpm,
      timestamp: Date.now(),
    }, { except: client });
  }

  // ─── base note (octave) ────────────────────────────────────────────

  _handleUpdateBaseNote(client, data) {
    const { slotIndex, baseNote } = data || {};
    if (typeof slotIndex !== "number" || slotIndex < 0 || slotIndex >= MAX_SLOTS) return;
    if (!this._ownsSlot(client.sessionId, slotIndex)) return;

    this.state.baseNotes.set(String(slotIndex), String(baseNote));

    // Broadcast to other clients
    this.broadcast("baseNoteUpdated", {
      slotIndex,
      baseNote,
      timestamp: data.timestamp || Date.now(),
    }, { except: client });
  }

  // ─── state queries ─────────────────────────────────────────────────

  /**
   * Send the full room state as a "room_initial_state" message.
   * This is triggered by the client's "requestInitialState" message,
   * typically sent ~3 seconds after joining.
   */
  _sendInitialState(client) {
    const payload = this._buildFullState();
    client.send("room_initial_state", payload);
  }

  /**
   * Send the room state as a "roomState" message.
   * Triggered by "requestRoomState" (used when opening the slot dialog).
   */
  _sendRoomState(client) {
    const payload = this._buildFullState();
    client.send("roomState", payload);
  }

  /**
   * Build a plain-object snapshot of the full room state.
   */
  _buildFullState() {
    // Build slots object: { "0": { sessionId, username }, ... }
    const slots = {};
    this.state.slots.forEach((slotInfo, key) => {
      slots[key] = {
        sessionId: slotInfo.sessionId,
        username: slotInfo.username,
      };
    });

    // Build presets object: { "0": "<json>", ... }
    const presets = {};
    this.state.presets.forEach((val, key) => {
      presets[key] = val;
    });

    // Build synthParams object
    const synthParams = {};
    this.state.synthParams.forEach((val, key) => {
      synthParams[key] = val;
    });

    // Build baseNotes object
    const baseNotes = {};
    this.state.baseNotes.forEach((val, key) => {
      baseNotes[key] = val;
    });

    return {
      slots,
      presets,
      synthParams,
      baseNotes,
      bpm: this.state.bpm,
      roomName: this.state.roomName,
      connectedClients: this.clients.length,
      timestamp: Date.now(),
    };
  }

  // ─── heartbeat ─────────────────────────────────────────────────────

  _sendHeartbeat() {
    this.broadcast("heartbeat", {
      timestamp: Date.now(),
      clientCount: this.clients.length,
    });
  }

  // ─── slot info broadcast ───────────────────────────────────────────

  /**
   * Broadcast current slot ownership to all clients.
   * @param {number[]} [releasedSlots] - indices that were just released
   */
  _broadcastSlotsInfo(releasedSlots) {
    const slots = {};
    this.state.slots.forEach((slotInfo, key) => {
      slots[key] = {
        sessionId: slotInfo.sessionId,
        username: slotInfo.username,
      };
    });

    this.broadcast("slotsInfoUpdated", {
      slots,
      releasedSlots: releasedSlots || [],
      timestamp: Date.now(),
    });
  }

  // ─── helpers ───────────────────────────────────────────────────────

  /**
   * Check whether a given session owns a particular slot.
   * If the slot is unclaimed we also allow the write (graceful fallback).
   */
  _ownsSlot(sessionId, slotIndex) {
    const existing = this.state.slots.get(String(slotIndex));
    if (!existing) return true; // unclaimed, allow
    return existing.sessionId === sessionId;
  }
}

module.exports = { RhythmRoom };
