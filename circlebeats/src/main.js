/**
 * CircleBeats - Main Entry Point
 *
 * This is the ES module entry point for Vite.
 * Currently it bridges legacy scripts by importing the two existing
 * module-type files (integration.js, three-scene.js) so that Vite
 * can resolve their bare-specifier imports (e.g. 'three') from
 * node_modules instead of relying on an importmap.
 *
 * All other legacy scripts remain as regular <script> tags in
 * index.html and will be migrated to ES module imports incrementally.
 */

// Event bus for future inter-module communication
import { eventBus } from './events.js';

// Expose the event bus globally so legacy scripts can use it
window.circleBeatsEventBus = eventBus;

// Import the two files that were already ES modules.
// three-scene.js uses bare-specifier imports like 'three' which Vite
// resolves from node_modules.
import '../three-scene.js';

// integration.js coordinates Three.js and p5.js interaction
import '../integration.js';

console.log('[CircleBeats] Module entry point loaded');
