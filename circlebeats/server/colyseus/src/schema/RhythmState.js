/**
 * RhythmState.js - Colyseus state schema for CircleBeats rhythm room.
 *
 * Note: The client (colyseus.js@0.15.12) relies on custom messages rather than
 * automatic schema-based state sync for most updates.  We therefore keep the
 * schema intentionally lightweight and drive synchronisation through explicit
 * message broadcasts in RhythmRoom.
 */

const schema = require("@colyseus/schema");
const { Schema, MapSchema, type } = schema;

/**
 * SlotInfo - tracks which session owns a slot and the associated username.
 */
class SlotInfo extends Schema {
  constructor() {
    super();
    this.sessionId = "";
    this.username = "";
  }
}
schema.defineTypes(SlotInfo, {
  sessionId: "string",
  username: "string",
});

/**
 * RhythmState - top-level room state.
 *
 * Fields:
 *   roomName   - human-readable room name
 *   bpm        - shared BPM (30-300)
 *   slots      - map of slotIndex -> SlotInfo
 *   presets    - map of slotIndex -> JSON string of preset pattern data
 *   synthParams - map of slotIndex -> JSON string of synth parameters
 *   baseNotes  - map of slotIndex -> base note string (e.g. "C4")
 */
class RhythmState extends Schema {
  constructor() {
    super();
    this.roomName = "rhythm_room";
    this.bpm = 120;
    this.slots = new MapSchema();
    this.presets = new MapSchema();
    this.synthParams = new MapSchema();
    this.baseNotes = new MapSchema();
  }
}
schema.defineTypes(RhythmState, {
  roomName: "string",
  bpm: "number",
  slots: { map: SlotInfo },
  presets: { map: "string" },
  synthParams: { map: "string" },
  baseNotes: { map: "string" },
});

module.exports = { RhythmState, SlotInfo };
