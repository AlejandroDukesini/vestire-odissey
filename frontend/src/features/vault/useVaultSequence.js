import { useCinematicSequence } from '../showcase/useCinematicSequence.js'

/**
 * VaultAnimationController: secuencia de apertura de la bóveda de relojes.
 *
 *  0 presentación   bóveda cerrada, lejana y en penumbra
 *  1 acercamiento   la cámara avanza en primera persona hasta la cerradura
 *  2 desbloqueo     gira la cerradura y se retraen los pernos
 *  3 apertura       la puerta pivota sobre sus bisagras; la cámara retrocede
 *  4 iluminación    se enciende el interior y aparecen los relojes en cascada
 *  5 exploración    la colección queda disponible; los relojes empiezan a girar
 *
 * El motor genérico (temporizadores, saltar, repetir, sonido) está en
 * showcase/useCinematicSequence.js; aquí solo se definen tiempos y efectos.
 */
export const STAGE_TIMES = [0, 450, 2100, 3500, 4300, 5600]
export const LAST_STAGE = STAGE_TIMES.length - 1

// Efectos sonoros por estilo (ms desde el inicio de la secuencia).
const CUES = {
  classic: [['dial', 2150], ['dial', 2600], ['bolts', 3150], ['unlatch', 3480], ['door', 3600], ['light', 4300]],
  modern: [['key', 2150], ['key', 2350], ['key', 2550], ['key', 2750], ['granted', 3000], ['bolts', 3200], ['unlatch', 3480], ['door', 3600], ['light', 4300]],
  futuristic: [['scan', 2150], ['granted', 3000], ['bolts', 3200], ['unlatch', 3480], ['door', 3600], ['light', 4300]],
  cabinet: [['key_turn', 2400], ['unlatch', 3480], ['door', 3600], ['light', 4300]],
}

export function useVaultSequence({ intro, reduced, sound, style }) {
  return useCinematicSequence({
    times: STAGE_TIMES, intro, reduced, sound, cues: CUES[style] ?? CUES.classic, sessionKey: 'odissey.vaultIntroShown',
  })
}
