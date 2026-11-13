import { createDb } from '../src/db/schema.js'

let n = 0
/** Base de datos aislada en memoria con nombre único: nunca la del usuario. */
export async function freshDb(versions) {
  const db = createDb(`test-${Date.now()}-${n++}`, versions)
  await db.open()
  return db
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPG_SIG = [0xff, 0xd8, 0xff, 0xe0]

/** Imagen sintética: cabecera válida + contenido variable (distinto sha256 por `seed`). */
export function fakeImage(name = 'foto.png', seed = 1, kind = 'png', size = 2048) {
  const sig = kind === 'png' ? PNG_SIG : JPG_SIG
  const bytes = new Uint8Array(size)
  bytes.set(sig)
  for (let i = sig.length; i < size; i++) bytes[i] = (i * 31 + seed * 7) & 0xff
  return new File([bytes], name, { type: kind === 'png' ? 'image/png' : 'image/jpeg' })
}

export async function blobBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer())
}
