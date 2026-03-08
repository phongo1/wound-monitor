import { Reading } from "../types/reading";

class MemoryStore {
  private readings: Reading[] = [];

  add(reading: Reading): void {
    this.readings.push(reading);
  }

  latest(): Reading | null {
    if (this.readings.length === 0) {
      return null;
    }
    return this.readings[this.readings.length - 1];
  }

  history(): Reading[] {
    return this.readings;
  }
}

export const memoryStore = new MemoryStore();
