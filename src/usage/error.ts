export class UsageError extends Error {
  constructor() {
    super("Usage data is unavailable");
    this.name = "UsageError";
  }
}
