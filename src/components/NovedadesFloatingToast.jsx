import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Siren,
  DoorOpen,
  FileCheck,
  Zap,
  X,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { ACTUALIZACIONES_CONFIG, LISTA_ACTUALIZACIONES } from '../data/actualizacionesData'

const ICON_MAP = {
  Siren: Siren,
  DoorOpen: DoorOpen,
  FileCheck: FileCheck,
  Zap: Zap
}

const DURATION_SECONDS = 10

export default function NovedadesFloatingToast({ isDarkMode = true, onClose }) {
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [isPaused, setIsPaused] = useState(false)
  const [visible, setVisible] = useState(true)
  const [minimized, setMinimized] = useState(false)

  // Countdown timer con intervalo suave de 100ms para animación fluida de la barra
  useEffect(() => {
    if (!visible) return

    const interval = setInterval(() => {
      if (!isPaused) {
        setTimeLeft(prev => {
          if (prev <= 0.1) {
            clearInterval(interval)
            handleClose()
            return 0
          }
          return Math.max(0, prev - 0.1)
        })
      }
    }, 100)

    return () => clearInterval(interval)
  }, [visible, isPaused])

  const handleClose = () => {
    setVisible(false)
    if (onClose) onClose()
  }

  if (!visible) return null

  const progressPercent = (timeLeft / DURATION_SECONDS) * 100

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className={`fixed bottom-6 left-4 sm:left-6 z-40 w-full max-w-[360px] sm:max-w-[400px] rounded-3xl border-2 shadow-2xl overflow-hidden backdrop-blur-2xl transition-all duration-300 ${
            isDarkMode
              ? 'bg-[#140808]/95 border-red-500/40 text-white shadow-black/80 ring-1 ring-red-500/20'
              : 'bg-white/95 border-red-200 text-slate-800 shadow-slate-400/40'
          }`}
        >
          {/* Header con barra de tiempo */}
          <div className="relative">
            {/* Barra de progreso de 10 segundos animada */}
            <div className="h-1.5 w-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-red-600 via-amber-400 to-rose-500"
                style={{ width: `${progressPercent}%` }}
                transition={{ ease: 'linear', duration: 0.1 }}
              />
            </div>

            {/* Cabecera */}
            <div className="p-3.5 pb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-rose-800 text-white flex items-center justify-center shadow-md shadow-red-950/60 shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-black text-xs">Novedades del Sistema</h4>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black font-mono bg-red-500/20 text-red-300 border border-red-500/30">
                      {ACTUALIZACIONES_CONFIG.version}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>
                      {isPaused ? 'Pausado (leyendo...)' : `Autocierre en ${Math.ceil(timeLeft)}s`}
                    </span>
                  </p>
                </div>
              </div>

              {/* Botones de control: minimizar y cerrar */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMinimized(!minimized)}
                  className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title={minimized ? 'Expandir' : 'Minimizar'}
                >
                  {minimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-300 transition-colors cursor-pointer"
                  title="Cerrar ventana"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Cuerpo con las 4 novedades */}
          {!minimized && (
            <div className="px-3.5 pb-3.5 space-y-2 max-h-[310px] overflow-y-auto pr-1.5">
              {LISTA_ACTUALIZACIONES.map((item) => {
                const Icon = ICON_MAP[item.icon] || Sparkles

                const tagStyles = {
                  rose: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                  blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                  amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }

                const iconStyles = {
                  rose: 'text-rose-400 bg-rose-500/15',
                  emerald: 'text-emerald-400 bg-emerald-500/15',
                  blue: 'text-blue-400 bg-blue-500/15',
                  amber: 'text-amber-400 bg-amber-500/15'
                }

                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/5 space-y-1 transition-all hover:bg-white/[0.08]"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${iconStyles[item.color]}`}>
                          <Icon className="w-3 h-3" />
                        </div>
                        <h5 className="font-bold text-[11px] truncate">{item.titulo}</h5>
                      </div>
                      <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider border shrink-0 ${tagStyles[item.tagColor]}`}>
                        {item.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/60 leading-relaxed pl-6">
                      {item.descripcion}
                    </p>
                  </div>
                )
              })}

              <div className="pt-1 flex items-center justify-between text-[10px] text-white/40">
                <span>Pasa el cursor para pausar</span>
                <button
                  type="button"
                  onClick={handleClose}
                  className="font-bold text-red-300 hover:text-red-200 underline cursor-pointer"
                >
                  Entendido, cerrar
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

