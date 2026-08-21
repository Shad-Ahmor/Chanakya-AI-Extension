"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Debouncer = void 0;
/**
 * A utility class for debouncing and throttling function calls to prevent spam
 * (e.g. fast typing triggering too many LLM completions or context extractions).
 */
class Debouncer {
    timers = new Map();
    /**
     * Debounces a function call by a given delay.
     * If called again with the same key before the delay expires, the timer resets.
     */
    debounce(key, fn, delayMs = 300) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }
        const timer = setTimeout(() => {
            this.timers.delete(key);
            fn();
        }, delayMs);
        this.timers.set(key, timer);
    }
    /**
     * Clears a specific debounced call.
     */
    clear(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
    }
    /**
     * Clears all pending debounced calls.
     */
    clearAll() {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
    }
}
exports.Debouncer = Debouncer;
//# sourceMappingURL=debouncer.js.map