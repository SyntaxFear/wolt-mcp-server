export type ErrorCode =
  | "LOCATION_REQUIRED"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "WOLT_API_CHANGED"
  | "NETWORK"
  | "INTERNAL";

export class WoltError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly nextStep: string,
  ) {
    super(message);
    this.name = "WoltError";
  }
}
