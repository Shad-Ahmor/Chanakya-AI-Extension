/**
 * A utility class for debouncing and throttling function calls to prevent spam 
 * (e.g. fast typing triggering too many LLM completions or context extractions).
 */
export class Debouncer {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Debounces a function call by a given delay.
   * If called again with the same key before the delay expires, the timer resets.
   */
  public debounce(key: string, fn: () => void, delayMs: number = 300): void {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
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
  public clear(key: string): void {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }
  }

  /**
   * Clears all pending debounced calls.
   */
  public clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
