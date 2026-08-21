import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PlayCircle,
  Clock,
  AlertTriangle,
  FileEdit,
  X,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  CheckCircle2
} from 'lucide-react'

const StartSessionModal = ({
  isOpen,
  onClose,
  horaInicio,
  docente,
  isDarkMode,
}) => {
  const [timeLeft, setTimeLeft] = useState(20)

  // Cuenta regresiva de 20 segundos con auto-cierre
  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(20)
      return
    }

    setTimeLeft(20)
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onClose()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop con Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window Container (Ultra responsivo y adaptado a cualquier altura de pantalla) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`
            relative z-10 w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border-2 my-auto
            ${isDarkMode
              ? 'bg-gradient-to-b from-[#180909] via-[#120606] to-[#0c0303] border-emerald-500/30 text-slate-100 shadow-black/90'
              : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 border-slate-300 text-slate-900 shadow-2xl shadow-slate-900/30'
            }
          `}
        >
          {/* Top Institutional Accent Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 shrink-0" />

          {/* Close Button (X) */}
          <button
            onClick={onClose}
            className={`
              absolute top-3.5 right-3.5 p-1.5 rounded-full border transition-all duration-200 z-20
              ${isDarkMode
                ? 'bg-white/10 border-white/15 text-slate-300 hover:text-white hover:bg-white/20'
                : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }
            `}
            title="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Modal Content Body con Scroll Suave interno si la pantalla es muy pequeña */}
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto custom-scrollbar">

            {/* Header Compacto con Icono de Inicio */}
            <div className="text-center space-y-1.5 pt-1">
              <div className="relative inline-flex items-center justify-center">
                <span className="animate-ping absolute inline-flex h-11 w-11 rounded-full bg-emerald-400 opacity-25"></span>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-600/30 text-white border border-emerald-400/40">
                  <PlayCircle className="w-7 h-7 stroke-[2.2]" />
                </div>
              </div>

              <div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-1 border ${
                  isDarkMode
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                }`}>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Clase en Curso • Semestre 2026-II
                </span>

                <h2 className={`text-lg sm:text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  ¡Inicio de Clase Registrado!
                </h2>
              </div>
            </div>

            {/* Tarjeta de Hora de Inicio (Compacta) */}
            <div className={`
              rounded-2xl border-2 p-3 text-center space-y-0.5
              ${isDarkMode
                ? 'bg-emerald-950/30 border-emerald-500/30'
                : 'bg-emerald-50 border-emerald-300'
              }
            `}>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 ${
                isDarkMode ? 'text-emerald-300' : 'text-emerald-800'
              }`}>
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                Hora Exacta de Inicio
              </span>
              <div className={`text-2xl sm:text-3xl font-black font-mono tracking-wider ${
                isDarkMode ? 'text-emerald-200' : 'text-emerald-900'
              }`}>
                {horaInicio || '--:--:--'}
              </div>
              <p className={`text-[11px] font-semibold truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Docente: <span className="font-bold">{docente?.nombre || 'Docente'}</span>
              </p>
            </div>

            {/* Indicaciones de llenado */}
            <div className={`p-3 rounded-2xl border flex items-start gap-2.5 ${
              isDarkMode
                ? 'bg-white/[0.04] border-white/10 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700 shadow-xs'
            }`}>
              <FileEdit className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-[11px] space-y-0.5 leading-relaxed">
                <p className="font-bold text-red-700 dark:text-red-400">
                  Instrucciones durante la sesión:
                </p>
                <p>
                  Durante su clase, complete los datos del formulario (<strong>Tema según sílabo, recursos y asistencia</strong>). Deberá completarlo para registrar su salida.
                </p>
              </div>
            </div>

            {/* ⚠️ Advertencia Importante: No cerrar la ventana */}
            <div className={`p-3 rounded-2xl border-2 flex items-start gap-2.5 ${
              isDarkMode
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}>
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px] space-y-0.5 leading-relaxed">
                <p className="font-black text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-300">
                  ⚠️ AVISO IMPORTANTE:
                </p>
                <p className="font-semibold">
                  <strong>No cierre esta pestaña ni apague la PC</strong> hasta concluir su clase, registrar su salida y enviar el registro completo.
                </p>
              </div>
            </div>

            {/* Botón de cierre y Barra de Cuenta Regresiva (10 segundos) */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-red-900 via-red-800 to-red-900 text-white shadow-lg shadow-red-950/40 hover:from-red-800 hover:to-red-700 flex items-center justify-center gap-2 transition-all cursor-pointer ring-2 ring-red-500/30"
              >
                <span>Continuar y Llenar Registro</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Barra de progreso de auto-cierre */}
              <div className="space-y-1 text-center">
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                    initial={{ width: '100%' }}
                    animate={{ width: `${(timeLeft / 20) * 100}%` }}
                    transition={{ duration: 1, ease: 'linear' }}
                  />
                </div>
                <p className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Esta ventana se cerrará automáticamente en <span className="font-bold font-mono text-emerald-500">{timeLeft}s</span>
                </p>
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default StartSessionModal
