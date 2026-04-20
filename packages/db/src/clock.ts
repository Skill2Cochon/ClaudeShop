/** Re-export the pure clock from @claudeshop/core to avoid duplication. */
export class SystemClock {
  now(): Date {
    return new Date();
  }
  nowIso(): string {
    return new Date().toISOString();
  }
}
