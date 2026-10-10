export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = `SteadDomainError:${status}:${code}`;
  }
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
): Response {
  return Response.json({ error: { code, message } }, { status });
}
