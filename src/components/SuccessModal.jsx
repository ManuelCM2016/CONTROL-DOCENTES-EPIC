import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  LogOut,
  PlusCircle,
  Clock,
  Database,
  Calendar,
  BookOpen,
  MapPin,
  Sparkles
} from 'lucide-react'

const SuccessModal = ({
  isOpen,
  docente,
  sessionData,
  isDarkMode,
  onLogout,
  onNuevoRegistro,
}) => {
  const [timeLeft, setTimeLeft] = useState(10)

  // Cuenta regresiva de 10 segundos con auto-cierre de sesión
  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(10)
      return
    }

    setTimeLeft(10)
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onLogout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, onLogout])

  if (!isOpen) return null

  const progressPercent = ((10 - timeLeft) / 10) * 100

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop con Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`
            relative z-10 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border-2 my-auto
            ${isDarkMode
              ? 'bg-gradient-to-b from-[#180808] via-[#120606] to-[#0c0404] border-white/15 text-slate-100 shadow-black/90'
              : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 border-slate-300 text-slate-900 shadow-slate-400/40'
            }
          `}
        >
          {/* Top Institutional Line (Emerald Success) */}
          <div className="h-2.5 w-full shrink-0 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

          {/* Modal Content */}
          <div className="p-6 sm:p-7 space-y-5 text-center">

            {/* Success Animated Badge */}
            <div className="relative inline-flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-20 w-20 rounded-full bg-emerald-400 opacity-25" />
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 flex items-center justify-center shadow-2xl shadow-emerald-500/40 text-white border-2 border-emerald-400/50">
                <CheckCircle2 className="w-11 h-11 stroke-[2.5]" />
              </div>
            </div>

            {/* Header Titles */}
            <div className="space-y-1.5">
              <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                isDarkMode
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
              }`}>
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                Sincronizado con Google Sheets
              </span>

              <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                ¡Sesión guardada y registrada exitosamente!
              </h2>

              <p className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Su registro de clase ha sido guardado en la base de datos institucional de la EPIC — UPT.
              </p>
            </div>

            {/* Mini Resumen de la Clase */}
            {sessionData && (
              <div className={`p-4 rounded-2xl border text-xs text-left space-y-2 ${
                isDarkMode ? 'bg-black/30 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center justify-between border-b pb-2 border-slate-200/50 dark:border-white/5">
                  <span className="font-bold truncate text-slate-800 dark:text-slate-200">
                    👤 {docente?.nombre || 'Docente'}
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                    #{sessionData.numero}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-maroon-500 shrink-0" />
                    <span className="truncate">{sessionData.asignatura || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-maroon-500 shrink-0" />
                    <span className="truncate">{sessionData.aulaLab || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-maroon-500 shrink-0" />
                    <span>{sessionData.fecha}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{sessionData.horaInicio} ➔ {sessionData.horaFinalizacion}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Countdown Progress Bar */}
            <div className={`p-3.5 rounded-2xl border space-y-2 ${
              isDarkMode ? 'bg-red-950/30 border-red-800/30' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  Cierre de sesión automático:
                </span>
                <span className="font-mono text-sm font-black px-2 py-0.5 rounded-lg bg-red-600 text-white">
                  {timeLeft}s
                </span>
              </div>

              <div className="w-full h-2 bg-slate-300 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${100 - progressPercent}%` }}
                />
              </div>
            </div>

            {/* Actions Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-red-800 via-red-700 to-red-900 text-white shadow-xl shadow-red-950/50 hover:from-red-700 hover:to-red-800 flex items-center justify-center gap-2.5 transition-all cursor-pointer ring-2 ring-red-500/40"
              >
                <LogOut className="w-5 h-5 text-red-200" />
                <span>Cerrar Sesión Ahora</span>
              </button>

              <button
                type="button"
                onClick={onNuevoRegistro}
                className={`w-full py-3 px-5 rounded-2xl font-bold text-xs border-2 flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isDarkMode
                    ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50'
                    : 'border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <PlusCircle className="w-4 h-4 text-emerald-500" />
                <span>Quedarme y Registrar Otra Clase</span>
              </button>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default SuccessModal
