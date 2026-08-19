/**
 * Genera un sonido de alerta tipo campana usando Web Audio API.
 * No requiere archivos de audio externos.
 */

let audioContext = null

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioContext
}

/**
 * Toca una secuencia de tonos tipo campana institucional.
 * Suena 3 veces con un patrón ascendente agradable.
 */
export const playAlertSound = () => {
  try {
    const ctx = getAudioContext()

    // Notas: Do5 → Mi5 → Sol5 (acorde mayor, suena profesional)
    const notes = [523.25, 659.25, 783.99]
    const startTime = ctx.currentTime

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(freq, startTime)

      // Envolvente suave: attack rápido, decay gradual
      const noteStart = startTime + i * 0.3
      gainNode.gain.setValueAtTime(0, noteStart)
      gainNode.gain.linearRampToValueAtTime(0.3, noteStart + 0.05)
      gainNode.gain.exponentialRampToValueAtTime(0.01, noteStart + 0.6)

      oscillator.start(noteStart)
      oscillator.stop(noteStart + 0.7)
    })

    // Segunda repetición más suave (a los 1.2s)
    setTimeout(() => {
      const ctx2 = getAudioContext()
      const startTime2 = ctx2.currentTime

      notes.forEach((freq, i) => {
        const osc = ctx2.createOscillator()
        const gain = ctx2.createGain()

        osc.connect(gain)
        gain.connect(ctx2.destination)

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, startTime2)

        const noteStart = startTime2 + i * 0.3
        gain.gain.setValueAtTime(0, noteStart)
        gain.gain.linearRampToValueAtTime(0.2, noteStart + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.01, noteStart + 0.5)

        osc.start(noteStart)
        osc.stop(noteStart + 0.6)
      })
    }, 1200)

  } catch (error) {
    console.warn('No se pudo reproducir el sonido de alerta:', error)
  }
}
