// Message templating + click-to-send links for WhatsApp broadcasts. Templates use
// {placeholders}; unknown ones are left visible (and reported) so a typo never
// silently sends "Halo , ..." to customers.
import { normalizePhone } from '@/lib/utils/customerInsights'

export const KNOWN_PLACEHOLDERS = ['nama', 'toko', 'invoice', 'total', 'tanggal'] as const

export type TemplateVars = Partial<Record<(typeof KNOWN_PLACEHOLDERS)[number], string>>

export function placeholdersIn(content: string): string[] {
  return Array.from(new Set(Array.from(content.matchAll(/\{([a-z_]+)\}/gi)).map((m) => m[1].toLowerCase())))
}

/** Placeholders the template uses that we do not know (likely typos). */
export function unknownPlaceholders(content: string): string[] {
  return placeholdersIn(content).filter((p) => !(KNOWN_PLACEHOLDERS as readonly string[]).includes(p))
}

/** Fills known placeholders. A known placeholder with no value for this
 * recipient becomes an empty string with surrounding spaces tidied; unknown
 * placeholders are left as written. */
export function renderTemplate(content: string, vars: TemplateVars): string {
  return content
    .replace(/\{([a-z_]+)\}/gi, (whole, key: string) => {
      const k = key.toLowerCase()
      if (!(KNOWN_PLACEHOLDERS as readonly string[]).includes(k)) return whole
      return vars[k as keyof TemplateVars] ?? ''
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim()
}

/** wa.me click-to-send link, or null when the phone is not a usable number. */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const n = normalizePhone(phone)
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null
}
