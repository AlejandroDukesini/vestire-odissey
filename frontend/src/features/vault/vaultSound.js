// Efectos sonoros sintetizados con Web Audio (sin archivos externos). Son sutiles y opcionales:
// solo suenan si el usuario los tiene activados y el navegador permite reproducir audio
// (requiere una interacción previa con la página; si no, se omiten en silencio).

let shared = null

function context() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!AC) return null
  if (!shared) {
    try { shared = new AC() } catch { return null }
  }
  return shared
}

function noiseBuffer(ctx) {
  const len = Math.floor(ctx.sampleRate * 1.5)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

/**
 * Crea un reproductor para una secuencia. `schedule(cues)` programa los efectos relativos al
 * instante actual; `stop()` silencia y libera los nodos (se llama al saltar o desmontar).
 */
export function createVaultSound(enabled) {
  const noop = { schedule() {}, stop() {} }
  if (!enabled) return noop
  if (globalThis.navigator?.userActivation && !globalThis.navigator.userActivation.hasBeenActive) return noop
  const ctx = context()
  if (!ctx) return noop
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const master = ctx.createGain()
  master.gain.value = 0.2
  master.connect(ctx.destination)
  const noise = noiseBuffer(ctx)
  const sources = []

  const burst = (t, { freq = 2400, q = 8, dur = 0.03, gain = 0.6, type = 'bandpass' } = {}) => {
    const src = ctx.createBufferSource()
    src.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = type; f.frequency.value = freq; f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(master)
    src.start(t, Math.random()); src.stop(t + dur + 0.05)
    sources.push(src)
  }

  const thump = (t, { from = 95, to = 38, dur = 0.32, gain = 0.9 } = {}) => {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(to, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(master)
    o.start(t); o.stop(t + dur + 0.05)
    sources.push(o)
    burst(t, { freq: 500, q: 1, dur: 0.12, gain: 0.35, type: 'lowpass' })
  }

  const sweep = (t, dur = 1.8) => {
    const src = ctx.createBufferSource()
    src.buffer = noise; src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'; f.Q.value = 3
    f.frequency.setValueAtTime(180, t)
    f.frequency.exponentialRampToValueAtTime(900, t + dur * 0.4)
    f.frequency.exponentialRampToValueAtTime(140, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.22, t + dur * 0.3)
    g.gain.linearRampToValueAtTime(0, t + dur)
    src.connect(f).connect(g).connect(master)
    src.start(t); src.stop(t + dur + 0.05)
    sources.push(src)
  }

  const tone = (t, { freq = 880, dur = 0.09, gain = 0.12, type = 'sine' } = {}) => {
    const o = ctx.createOscillator()
    o.type = type; o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(master)
    o.start(t); o.stop(t + dur + 0.05)
    sources.push(o)
  }

  const fx = {
    dial: (t) => { for (let i = 0; i < 14; i++) burst(t + i * 0.07 + Math.random() * 0.015, { freq: 3200 + Math.random() * 900, gain: 0.35 }) },
    key: (t) => tone(t, { freq: 1320, dur: 0.07, gain: 0.08, type: 'square' }),
    granted: (t) => { tone(t, { freq: 988, gain: 0.08 }); tone(t + 0.11, { freq: 1480, gain: 0.08 }) },
    scan: (t) => { for (let i = 0; i < 6; i++) tone(t + i * 0.12, { freq: 420 + i * 140, dur: 0.1, gain: 0.05, type: 'triangle' }) },
    key_turn: (t) => { burst(t, { freq: 2600, gain: 0.5 }); burst(t + 0.18, { freq: 1900, gain: 0.6 }) },
    bolts: (t) => { for (let i = 0; i < 4; i++) thump(t + i * 0.06, { from: 140, to: 60, dur: 0.16, gain: 0.35 }) },
    unlatch: (t) => thump(t),
    door: (t) => sweep(t, 2.2),
    light: (t) => { burst(t, { freq: 5200, gain: 0.25, dur: 0.02 }); tone(t + 0.02, { freq: 120, dur: 1.4, gain: 0.03 }) },
  }

  return {
    schedule(cues) {
      const now = ctx.currentTime + 0.02
      for (const [name, at] of cues) fx[name]?.(now + at / 1000)
    },
    stop() {
      try {
        master.gain.cancelScheduledValues(ctx.currentTime)
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.03)
        setTimeout(() => { sources.forEach((s) => { try { s.stop() } catch { /* ya detenido */ } }); master.disconnect() }, 150)
      } catch { /* contexto cerrado */ }
    },
  }
}
