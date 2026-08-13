function extractExtension(name: string) {
  const lastDot = name.lastIndexOf('.')
  if (lastDot <= 0) return ''
  return name
    .slice(lastDot)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, '')
}

/** Supabase Storage object key — ASCII only (original name is kept in DB metadata). */
export function sanitizeStorageFilename(name: string) {
  const trimmed = name.trim() || 'file'
  const ext = extractExtension(trimmed)
  const stem = trimmed.slice(0, trimmed.length - ext.length)
  const asciiStem = stem
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60)

  if (asciiStem) {
    return `${asciiStem}${ext}`.slice(0, 120)
  }

  return `${crypto.randomUUID()}${ext}`
}

export function buildStorageObjectPath(parentId: string, originalName: string) {
  return `${parentId}/${Date.now()}-${sanitizeStorageFilename(originalName)}`
}
