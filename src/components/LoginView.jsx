import { useState } from 'react'
import { motion } from 'framer-motion'
import { UserCircle, ArrowRight, Shield, Sun, Moon } from 'lucide-react'

const LoginView = ({ onLogin, onAdminAccess, isDarkMode, toggleTheme }) => {
  const [dni, setDni] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!dni.trim()) {
      setError('Por favor, ingrese su DNI o código')
      return
    }
    if (dni.length < 4) {
      setError('Ingrese al menos 4 caracteres')
      return
    }
    setError('')
    onLogin(dni)
  }

  const handleDniChange = (e) => {
    // Permite números y letras (para códigos como D001)
    const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
    setDni(value)
    if (error) setError('')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-500"
      style={{
        background: isDarkMode
          ? 'linear-gradient(135deg, #1a0a0a 0%, #2d1515 25%, #3B0D0D 50%, #2d1515 75%, #1a0a0a 100%)'
          : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 40%, #e2e8f0 70%, #f1f5f9 100%)'
      }}
    >
      <div className="absolute inset-0" style={{
        background: isDarkMode
          ? 'linear-gradient(135deg, #1a0a0a 0%, #2d1515 25%, #3B0D0D 50%, #2d1515 75%, #1a0a0a 100%)'
          : 'linear-gradient(135deg, #e2e8f0 0%, #dde4ed 30%, #d1d9e6 60%, #e2e8f0 100%)'
      }}></div>

      {/* Botón de cambio de tema */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-full border-2 transition-all duration-300 ${isDarkMode
              ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-md'
            }`}
          title="Cambiar modo claro/oscuro"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: { duration: 60, repeat: Infinity, ease: 'linear' },
            scale: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="absolute -top-1/2 -right-1/2 w-full h-full"
          style={{
            background: isDarkMode
              ? 'radial-gradient(circle, rgba(123,45,45,0.15) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(123,45,45,0.06) 0%, transparent 70%)',
          }}
        />
        <motion.div
          animate={{
            rotate: -360,
            scale: [1, 1.15, 1],
          }}
          transition={{
            rotate: { duration: 50, repeat: Infinity, ease: 'linear' },
            scale: { duration: 10, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="absolute -bottom-1/2 -left-1/2 w-full h-full"
          style={{
            background: isDarkMode
              ? 'radial-gradient(circle, rgba(123,45,45,0.1) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(100,116,139,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: isDarkMode
              ? `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`
              : `linear-gradient(rgba(0,0,0,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.15) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className={`rounded-3xl border-2 overflow-hidden transition-colors duration-500 ${isDarkMode
            ? 'bg-white/[0.07] backdrop-blur-2xl border-white/10 shadow-2xl shadow-black/50'
            : 'bg-white border-slate-200 shadow-2xl shadow-slate-400/30'
          }`}>
          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-red-900 via-red-700 to-red-900" />

          <div className="p-8 sm:p-10">
            {/* Logo Section */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center mb-8"
            >
              {/* Logo — 3 clics rápidos abre el panel admin (acceso oculto) */}
              <div
                className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg ring-4 transition-colors duration-500 cursor-default select-none ${isDarkMode
                    ? 'bg-gradient-to-br from-maroon-800 to-maroon-950 shadow-maroon-900/30 ring-maroon-700/20'
                    : 'bg-slate-50 shadow-slate-300/50 ring-slate-200'
                  }`}
                onClick={() => {
                  if (!window._logoClickCount) window._logoClickCount = 0
                  if (!window._logoClickTimer) window._logoClickTimer = null
                  window._logoClickCount++
                  clearTimeout(window._logoClickTimer)
                  window._logoClickTimer = setTimeout(() => { window._logoClickCount = 0 }, 1000)
                  if (window._logoClickCount >= 3) {
                    window._logoClickCount = 0
                    if (onAdminAccess) onAdminAccess()
                  }
                }}
              >
                <img src="/logo.png" alt="Logo UPT" className="w-16 h-16 object-contain" />
              </div>

              <h1 className={`font-bold text-lg tracking-wider mb-1 transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                UNIVERSIDAD PRIVADA DE TACNA
              </h1>
              <div className={`h-px w-48 mx-auto my-3 ${isDarkMode ? 'bg-gradient-to-r from-transparent via-maroon-500/50 to-transparent' : 'bg-gradient-to-r from-transparent via-slate-300 to-transparent'}`} />
              <p className={`text-sm font-bold tracking-wide transition-colors duration-500 ${isDarkMode ? 'text-maroon-300/80' : 'text-red-900'}`}>
                ESCUELA PROFESIONAL DE INGENIERÍA CIVIL
              </p>
              <p className={`text-xs mt-2 tracking-widest uppercase font-medium transition-colors duration-500 ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>
                Ficha de Seguimiento de Avance Silábico
              </p>
            </motion.div>

            {/* Form */}
            <motion.form
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* DNI Input */}
              <div>
                <label className={`block text-xs font-bold tracking-wider uppercase mb-2.5 ml-1 transition-colors duration-500 ${isDarkMode ? 'text-white/60' : 'text-slate-700'}`}>
                  DNI del Docente
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserCircle
                      className={`w-5 h-5 transition-colors duration-300 ${isFocused
                          ? 'text-red-800'
                          : (isDarkMode ? 'text-white/30' : 'text-slate-400')
                        }`}
                    />
                  </div>
                  <input
                    type="text"
                    value={dni}
                    onChange={handleDniChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Ingrese su DNI"
                    className={`
                      w-full pl-12 pr-4 py-4 rounded-xl
                      text-lg font-semibold tracking-wider
                      transition-all duration-300 ease-out
                      focus:outline-none border-2
                      ${isDarkMode
                        ? 'bg-white/[0.06] text-white placeholder:text-white/25 ' + (error
                          ? 'border-red-500/60 focus:border-red-400 focus:ring-4 focus:ring-red-500/10'
                          : 'border-white/10 focus:border-maroon-500/60 focus:ring-4 focus:ring-maroon-500/10 hover:border-white/20')
                        : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 ' + (error
                          ? 'border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-600/20'
                          : 'border-slate-300 focus:border-red-800 focus:ring-2 focus:ring-red-800/20 hover:border-slate-400')
                      }
                    `}
                    maxLength={8}
                    autoComplete="off"
                    autoFocus
                    id="dni-input"
                  />
                  {/* Character counter */}
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className={`text-xs font-mono font-bold transition-colors duration-300 ${dni.length >= 4
                        ? (isDarkMode ? 'text-green-400/80' : 'text-emerald-600')
                        : (isDarkMode ? 'text-white/20' : 'text-slate-400')
                      }`}>
                      {dni.length}/8
                    </span>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-xs mt-2 ml-1 flex items-center gap-1.5 font-semibold ${isDarkMode ? 'text-red-400/90' : 'text-red-600'}`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {error}
                  </motion.p>
                )}
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  w-full py-4 rounded-xl font-bold text-base tracking-wide
                  flex items-center justify-center gap-3
                  transition-all duration-300 ease-out cursor-pointer
                  ${dni.length >= 4
                    ? 'bg-gradient-to-r from-red-900 to-red-800 text-white shadow-lg shadow-red-900/30 hover:shadow-xl hover:shadow-red-900/40 hover:from-red-800 hover:to-red-700'
                    : isDarkMode
                      ? 'bg-white/[0.06] text-white/30 cursor-not-allowed border border-white/5'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border-2 border-slate-200'
                  }
                `}
                disabled={dni.length < 4}
                id="btn-ingresar"
              >
                <span>Ingresar al Sistema</span>
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.form>

            {/* Footer info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="mt-8 text-center"
            >
              <div className={`flex items-center justify-center gap-2 text-xs font-medium transition-colors duration-500 ${isDarkMode ? 'text-white/20' : 'text-slate-500'}`}>
                <Shield className="w-3.5 h-3.5" />
                <span>Sistema de uso exclusivo para docentes</span>
              </div>
              <p className={`text-[10px] mt-2 tracking-wider font-medium transition-colors duration-500 ${isDarkMode ? 'text-white/15' : 'text-slate-400'}`}>
                ANEXO C — Control Interno de Avance Silábico
              </p>
            </motion.div>
          </div>
        </div>

        {/* Ambient glow below card */}
        <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 blur-3xl rounded-full ${isDarkMode ? 'bg-maroon-800/20' : 'bg-slate-400/15'}`} />
      </motion.div>
    </motion.div>
  )
}

export default LoginView
