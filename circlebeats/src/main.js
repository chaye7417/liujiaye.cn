/**
 * CircleBeats - Main Entry Point
 *
 * ES module entry point loaded via <script type="module"> in index.html.
 * Three.js bare-specifier imports (e.g. 'three', 'three/examples/...')
 * are resolved via the <script type="importmap"> block in index.html,
 * which maps them to unpkg CDN URLs. No bundler required.
 *
 * All other legacy scripts remain as regular <script> tags in
 * index.html and will be migrated to ES module imports incrementally.
 */

// Event bus for future inter-module communication
import { eventBus } from './events.js';

// Expose the event bus globally so legacy scripts can use it
window.circleBeatsEventBus = eventBus;

// Import the two files that were already ES modules.
// three-scene.js uses bare-specifier imports like 'three' which are
// resolved via importmap in index.html.
import '../three-scene.js';

// integration.js coordinates Three.js and p5.js interaction
import '../integration.js';

console.log('[CircleBeats] Module entry point loaded');
