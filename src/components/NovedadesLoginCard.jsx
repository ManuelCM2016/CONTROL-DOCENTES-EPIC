import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Siren,
  DoorOpen,
  FileCheck,
  Zap,
  ChevronRight,
  Shield,
  Layers,
  X,
  ExternalLink
} from 'lucide-react'
import { ACTUALIZACIONES_CONFIG, LISTA_ACTUALIZACIONES } from '../data/actualizacionesData'

const ICON_MAP = {
  Siren: Siren,
  DoorOpen: DoorOpen,
  FileCheck: FileCheck,
  Zap: Zap
}

export default function NovedadesLoginCard({ isDarkMode = true }) {
  const [mobileModalOpen, setMobileModalOpen] = useState(false)

  return (
    <>
      {/* ── BOTÓN FLOTANTE EN MÓVILES (Pantallas < lg) ── */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          type="button"
          onClick={() => setMobileModalOpen(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-xs shadow-xl backdrop-blur-xl border transition-all cursor-pointer ${
            isDarkMode
              ? 'bg-red-950/80 border-red-500/40 text-red-200 shadow-red-950/60'
              : 'bg-white/90 border-red-300 text-red-900 shadow-slate-300'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>Novedades del Sistema ({ACTUALIZACIONES_CONFIG.version})</span>
        </button>
      </div>

      {/* ── MODAL FLOTANTE PARA MÓVILES ── */}
      <AnimatePresence>
        {mobileModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setMobileModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-sm rounded-3xl border-2 p-5 space-y-4 max-h-[85vh] overflow-y-auto ${
                isDarkMode
                  ? 'bg-[#180a0a]/95 border-red-500/30 text-white'
                  : 'bg-white border-red-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-600/30 text-red-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm">{ACTUALIZACIONES_CONFIG.titulo}</h3>
                    <p className="text-[10px] text-white/50">{ACTUALIZACIONES_CONFIG.version} • {ACTUALIZACIONES_CONFIG.fecha}</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileModalOpen(false)}
                  className="p-1.5 rounded-xl bg-white/10 text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                {LISTA_ACTUALIZACIONES.map(item => {
                  const Icon = ICON_MAP[item.icon] || Sparkles
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-red-400" />
                          <span className="font-bold text-xs">{item.titulo}</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-500/20 text-red-300">
                          {item.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60 leading-relaxed pl-6">
                        {item.descripcion}
                      </p>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CARD FLOTANTE ADOSADO EN DESKTOP (lg:flex) ── */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.35, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="hidden lg:flex flex-col w-96 shrink-0 relative z-10"
      >
        <div
          className={`rounded-3xl border-2 overflow-hidden transition-all duration-500 relative ${
            isDarkMode
              ? 'bg-white/[0.06] backdrop-blur-2xl border-white/10 shadow-2xl shadow-black/60'
              : 'bg-white/90 backdrop-blur-xl border-slate-200 shadow-2xl shadow-slate-400/20'
          }`}
        >
          {/* Top accent gradient bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-amber-500 to-rose-600" />

          <div className="p-6 space-y-4">
            {/* Header del Card */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-rose-900 text-white flex items-center justify-center shadow-lg shadow-red-950/60 ring-2 ring-red-400/30 shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-black text-sm tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      Novedades & Cambios
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-red-500/20 text-red-300 border border-red-500/30">
                      {ACTUALIZACIONES_CONFIG.version}
                    </span>
                  </div>
                  <p className={`text-[11px] font-medium ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>
                    {ACTUALIZACIONES_CONFIG.semestre} • Actualizado
                  </p>
                </div>
              </div>
            </div>

            {/* Separador sutil */}
            <div className={`h-px w-full ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`} />

            {/* Lista de Novedades */}
            <div className="space-y-3">
              {LISTA_ACTUALIZACIONES.map((item) => {
                const Icon = ICON_MAP[item.icon] || Sparkles

                const tagStyles = {
                  rose: isDarkMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-rose-100 text-rose-800 border-rose-200',
                  emerald: isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-200',
                  blue: isDarkMode ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-100 text-blue-800 border-blue-200',
                  amber: isDarkMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-100 text-amber-800 border-amber-200'
                }

                const iconStyles = {
                  rose: isDarkMode ? 'text-rose-400 bg-rose-500/10' : 'text-rose-600 bg-rose-50',
                  emerald: isDarkMode ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-600 bg-emerald-50',
                  blue: isDarkMode ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-50',
                  amber: isDarkMode ? 'text-amber-400 bg-amber-500/10' : 'text-amber-600 bg-amber-50'
                }

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border transition-all duration-300 ${
                      isDarkMode
                        ? 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5 hover:border-white/15'
                        : 'bg-slate-50/80 hover:bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${iconStyles[item.color]}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <h4 className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {item.titulo}
                        </h4>
                      </div>

                      <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border shrink-0 ${tagStyles[item.tagColor]}`}>
                        {item.tag}
                      </span>
                    </div>

                    <p className={`text-[11px] leading-relaxed pl-9 ${isDarkMode ? 'text-white/60' : 'text-slate-600'}`}>
                      {item.descripcion}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Footer institucional informativo */}
            <div className={`pt-2 border-t flex items-center gap-2 text-[10px] ${
              isDarkMode ? 'border-white/10 text-white/40' : 'border-slate-200 text-slate-500'
            }`}>
              <Shield className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>Dirección EPIC • Asistencia disponible durante clases</span>
            </div>
          </div>
        </div>

        {/* Ambient glow below card */}
        <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 blur-3xl rounded-full pointer-events-none ${
          isDarkMode ? 'bg-red-800/15' : 'bg-red-400/10'
        }`} />
      </motion.div>
    </>
  )
}

