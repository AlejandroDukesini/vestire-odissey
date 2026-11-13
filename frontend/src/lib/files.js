// Validación de archivos por contenido real (bytes mágicos), no solo por extensión o MIME declarado.

export class FileValidationError extends Error {
  constructor(message, fileName) {
    super(message)
    this.name = 'FileValidationError'
    this.fileName = fileName
  }
}

const startsWith = (b, sig, offset = 0) => sig.every((x, i) => b[offset + i] === x)
const ascii = (s) => [...s].map((c) => c.charCodeAt(0))

/** Detecta el tipo real del archivo a partir de sus primeros bytes. */
export function sniffType(bytes) {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg', category: 'image' }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png', category: 'image' }
  if (startsWith(bytes, ascii('GIF8'))) return { mime: 'image/gif', ext: 'gif', category: 'image' }
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return { mime: 'image/webp', ext: 'webp', category: 'image' }
  if (startsWith(bytes, ascii('ftyp'), 4) && (startsWith(bytes, ascii('avif'), 8) || startsWith(bytes, ascii('avis'), 8))) {
    return { mime: 'image/avif', ext: 'avif', category: 'image' }
  }
  if (startsWith(bytes, ascii('ftyp'), 4) && (startsWith(bytes, ascii('heic'), 8) || startsWith(bytes, ascii('heix'), 8) || startsWith(bytes, ascii('mif1'), 8))) {
    return { mime: 'image/heic', ext: 'heic', category: 'unsupported-image' }
  }
  if (startsWith(bytes, ascii('glTF'))) return { mime: 'model/gltf-binary', ext: 'glb', category: 'model' }
  return null
}

export const EXT_BY_MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/avif': 'avif', 'model/gltf-binary': 'glb',
}

export async function sha256Hex(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Lee y valida una imagen. Devuelve { bytes, mime, ext, sha256, size }.
 * @param {Blob|File} file
 */
export async function inspectImage(file, { maxBytes = 40 * 1024 * 1024 } = {}) {
  const name = file.name || 'archivo'
  if (!file.size) throw new FileValidationError(`"${name}" está vacío`, name)
  if (file.size > maxBytes) {
    throw new FileValidationError(
      `"${name}" pesa ${(file.size / 1048576).toFixed(1)} MB; el límite configurado es ${(maxBytes / 1048576).toFixed(0)} MB`,
      name,
    )
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffType(bytes)
  if (type?.category === 'unsupported-image') {
    throw new FileValidationError(`"${name}" es HEIC; el navegador no puede mostrarlo. Conviértelo a JPG o PNG.`, name)
  }
  if (!type || type.category !== 'image') {
    throw new FileValidationError(`"${name}" no es una imagen compatible (JPG, PNG, WEBP, GIF o AVIF)`, name)
  }
  return { bytes, mime: type.mime, ext: type.ext, sha256: await sha256Hex(bytes), size: bytes.byteLength }
}

/**
 * Valida un modelo 3D. En esta versión se admite GLB (glTF 2.0 binario, autocontenido).
 * GLTF con archivos externos, OBJ y STL quedan pendientes.
 */
export async function inspectModel(file, { maxBytes = 200 * 1024 * 1024 } = {}) {
  const name = file.name || 'modelo'
  if (!file.size) throw new FileValidationError(`"${name}" está vacío`, name)
  if (file.size > maxBytes) {
    throw new FileValidationError(`"${name}" supera el límite de ${(maxBytes / 1048576).toFixed(0)} MB para modelos 3D`, name)
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffType(bytes)
  if (type?.category !== 'model') throw new FileValidationError(`"${name}" no es un modelo GLB válido. Exporta el modelo como .glb (glTF 2.0 binario).`, name)
  const version = new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true)
  if (version !== 2) throw new FileValidationError(`"${name}" usa glTF ${version}; solo se admite glTF 2.0`, name)
  return { bytes, mime: type.mime, ext: type.ext, sha256: await sha256Hex(bytes), size: bytes.byteLength }
}

/**
 * Genera una miniatura para previsualización. El original nunca se modifica.
 * Devuelve null si el entorno no puede decodificar la imagen (la UI usa entonces el original).
 */
export async function makeThumbnail(blob, maxSide = 560) {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return null
  let bmp
  try {
    bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    const { width, height } = bmp
    const scale = Math.min(1, maxSide / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, w, h)
    const thumb = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })
    return { blob: thumb, width, height }
  } catch {
    return null
  } finally {
    bmp?.close?.()
  }
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}
