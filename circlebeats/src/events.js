/**
 * Event bus for inter-module communication.
 *
 * Usage:
 *   import { eventBus } from './events.js';
 *   eventBus.addEventListener('my-event', (e) => console.log(e.detail));
 *   eventBus.dispatchEvent(new CustomEvent('my-event', { detail: data }));
 */
export const eventBus = new EventTarget();
