// ── AppError — erro de negócio com status HTTP ──────────────────────────
// Padrão dos services: lançar AppError com mensagem e statusCode,
// tratado no controller (res.status(err.statusCode || 500)).
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export default AppError;