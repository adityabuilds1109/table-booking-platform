// An error the client is allowed to see. The central error middleware turns it into
// { "error": { "code", "message" } }; anything that is not an AppError is treated as unexpected.
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
