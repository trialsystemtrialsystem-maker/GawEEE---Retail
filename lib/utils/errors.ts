export interface DbErrorLike {
  code?: string
  message?: string
}

/** Maps a Postgres/PostgREST error into an HTTP status + user-facing message. */
export function handleDatabaseError(error: unknown): { status: number; message: string } {
  const err = error as DbErrorLike

  switch (err?.code) {
    case '23505': // unique_violation
      return { status: 409, message: 'Data sudah ada (duplikat).' }
    case '23503': // foreign_key_violation
      return { status: 400, message: 'Referensi data tidak valid.' }
    case '23514': // check_violation
      return { status: 400, message: 'Data tidak memenuhi aturan validasi.' }
    case 'PGRST116': // no rows found (PostgREST single())
      return { status: 404, message: 'Data tidak ditemukan.' }
    default:
      return { status: 500, message: err?.message ?? 'Terjadi kesalahan pada server.' }
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}
