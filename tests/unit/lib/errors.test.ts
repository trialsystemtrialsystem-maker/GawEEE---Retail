import { handleDatabaseError, ApiError } from '@/lib/utils/errors'

describe('handleDatabaseError', () => {
  it('maps unique_violation to 409', () => {
    expect(handleDatabaseError({ code: '23505' })).toEqual({ status: 409, message: 'Data sudah ada (duplikat).' })
  })

  it('maps foreign_key_violation to 400', () => {
    expect(handleDatabaseError({ code: '23503' })).toEqual({ status: 400, message: 'Referensi data tidak valid.' })
  })

  it('maps check_violation to 400', () => {
    expect(handleDatabaseError({ code: '23514' })).toEqual({ status: 400, message: 'Data tidak memenuhi aturan validasi.' })
  })

  it('maps PostgREST no-rows to 404', () => {
    expect(handleDatabaseError({ code: 'PGRST116' })).toEqual({ status: 404, message: 'Data tidak ditemukan.' })
  })

  it('falls back to 500 with the raw message for an unknown code', () => {
    expect(handleDatabaseError({ code: 'XX000', message: 'boom' })).toEqual({ status: 500, message: 'boom' })
  })

  it('falls back to a generic message when nothing is available', () => {
    expect(handleDatabaseError(null)).toEqual({ status: 500, message: 'Terjadi kesalahan pada server.' })
  })
})

describe('ApiError', () => {
  it('carries a status and behaves as an Error', () => {
    const err = new ApiError(403, 'Forbidden')
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(403)
    expect(err.message).toBe('Forbidden')
    expect(err.name).toBe('ApiError')
  })
})
