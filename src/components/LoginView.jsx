import { useState } from 'react'
import { motion } from 'framer-motion'
import { UserCircle, ArrowRight, Shield, Building2, Sun, Moon } from 'lucide-react'

const LoginView = ({ onLogin, isDarkMode, toggleTheme }) => {
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
      className={`min-h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-500`}
      style={{
        background: isDarkMode 
          ? 'linear-gradient(135deg, #1a0a0a 0%, #2d1515 25%, #3B0D0D 50%, #2d1515 75%, #1a0a0a 100%)'
          : 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 25%, #d1c4e9 50%, #e8e8e8 75%, #f5f5f5 100%)' // Wait, the user said "fondo debe ser degradado del color principal pero que no opaque la vista". The main color is maroon. A light maroon gradient:
      }}
    >
      <div className="absolute inset-0" style={{
        background: isDarkMode
          ? 'linear-gradient(135deg, #1a0a0a 0%, #2d1515 25%, #3B0D0D 50%, #2d1515 75%, #1a0a0a 100%)'
          : 'linear-gradient(135deg, #fdfbfb 0%, #f4e9e9 50%, #fdfbfb 100%)'
      }}></div>

      {/* Botón de cambio de tema */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-full backdrop-blur-md border transition-all duration-300 ${
            isDarkMode 
              ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' 
              : 'bg-maroon-900/10 border-maroon-900/20 text-maroon-900 hover:bg-maroon-900/20'
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
              : 'radial-gradient(circle, rgba(123,45,45,0.08) 0%, transparent 70%)',
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
              : 'radial-gradient(circle, rgba(123,45,45,0.05) 0%, transparent 70%)',
          }}
        />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: isDarkMode
              ? `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`
              : `linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.3) 1px, transparent 1px)`,
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
        <div className={`backdrop-blur-2xl rounded-3xl border shadow-2xl overflow-hidden transition-colors duration-500 ${
          isDarkMode 
            ? 'bg-white/[0.07] border-white/10 shadow-black/50' 
            : 'bg-white/80 border-white/40 shadow-maroon-900/10'
        }`}>
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-maroon-700 via-maroon-500 to-maroon-700" />
          
          <div className="p-8 sm:p-10">
            {/* Logo Section */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center mb-8"
            >
              {/* Logo */}
              <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg ring-4 transition-colors duration-500 ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-maroon-800 to-maroon-950 shadow-maroon-900/30 ring-maroon-700/20'
                  : 'bg-white shadow-maroon-900/10 ring-white/50'
              }`}>
                <img src="/logo.png" alt="Logo UPT" className="w-16 h-16 object-contain" />
              </div>
              
              <h1 className={`font-bold text-lg tracking-wider mb-1 transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-maroon-950'}`}>
                UNIVERSIDAD PRIVADA DE TACNA
              </h1>
              <div className="h-px w-48 mx-auto bg-gradient-to-r from-transparent via-maroon-500/50 to-transparent my-3" />
              <p className={`text-sm font-medium tracking-wide transition-colors duration-500 ${isDarkMode ? 'text-maroon-300/80' : 'text-maroon-700'}`}>
                ESCUELA PROFESIONAL DE INGENIERÍA CIVIL
              </p>
              <p className={`text-xs mt-2 tracking-widest uppercase transition-colors duration-500 ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>
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
                <label className={`block text-xs font-semibold tracking-wider uppercase mb-2.5 ml-1 transition-colors duration-500 ${isDarkMode ? 'text-white/60' : 'text-maroon-900/60'}`}>
                  DNI o Código del Docente
                </label>
                <div className={`relative group`}>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserCircle 
                      className={`w-5 h-5 transition-colors duration-300 ${
                        isFocused 
                          ? 'text-maroon-500' 
                          : (isDarkMode ? 'text-white/30' : 'text-maroon-900/30')
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
                      text-lg font-medium tracking-wider
                      transition-all duration-300 ease-out
                      focus:outline-none border-2
                      ${isDarkMode 
                        ? 'bg-white/[0.06] text-white placeholder:text-white/25 ' + (error 
                          ? 'border-red-500/60 focus:border-red-400 focus:ring-4 focus:ring-red-500/10' 
                          : 'border-white/10 focus:border-maroon-500/60 focus:ring-4 focus:ring-maroon-500/10 hover:border-white/20')
                        : 'bg-white/50 text-maroon-950 placeholder:text-maroon-900/25 ' + (error
                          ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                          : 'border-maroon-900/10 focus:border-maroon-600 focus:ring-4 focus:ring-maroon-600/10 hover:border-maroon-900/20')
                      }
                    `}
                    maxLength={8}
                    autoComplete="off"
                    autoFocus
                    id="dni-input"
                  />
                  {/* Character counter */}
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className={`text-xs font-mono transition-colors duration-300 ${
                      dni.length >= 4 
                        ? (isDarkMode ? 'text-green-400/80' : 'text-emerald-600/80')
                        : (isDarkMode ? 'text-white/20' : 'text-maroon-900/20')
                    }`}>
                      {dni.length}/8
                    </span>
                  </div>
                </div>
                
                {/* Error message */}
                <AnimatePresenceWrapper show={!!error}>
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-red-400/90 text-xs mt-2 ml-1 flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {error}
                  </motion.p>
                </AnimatePresenceWrapper>
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  w-full py-4 rounded-xl font-semibold text-base tracking-wide
                  flex items-center justify-center gap-3
                  transition-all duration-300 ease-out
                  ${dni.length >= 4
                    ? 'bg-gradient-to-r from-maroon-700 to-maroon-800 text-white shadow-lg shadow-maroon-900/30 hover:shadow-xl hover:shadow-maroon-900/40 hover:from-maroon-600 hover:to-maroon-700'
                    : isDarkMode 
                      ? 'bg-white/[0.06] text-white/30 cursor-not-allowed border border-white/5'
                      : 'bg-black/5 text-maroon-900/30 cursor-not-allowed border border-black/5'
                  }
                `}
                disabled={dni.length < 4}
                id="btn-ingresar"
              >
                <span>Ingresar al Sistema</span>
                <ArrowRight className={`w-5 h-5 transition-transform duration-300 ${
                  dni.length >= 4 ? 'group-hover:translate-x-1' : ''
                }`} />
              </motion.button>
            </motion.form>

            {/* Footer info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="mt-8 text-center"
            >
              <div className={`flex items-center justify-center gap-2 text-xs transition-colors duration-500 ${isDarkMode ? 'text-white/20' : 'text-slate-400'}`}>
                <Shield className="w-3.5 h-3.5" />
                <span>Sistema de uso exclusivo para docentes</span>
              </div>
              <p className={`text-[10px] mt-2 tracking-wider transition-colors duration-500 ${isDarkMode ? 'text-white/15' : 'text-slate-400/70'}`}>
                ANEXO C — Control Interno de Avance Silábico
              </p>
            </motion.div>
          </div>
        </div>

        {/* Ambient glow below card */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-maroon-800/20 blur-3xl rounded-full" />
      </motion.div>
    </motion.div>
  )
}

// Simple wrapper to conditionally render with animation
const AnimatePresenceWrapper = ({ show, children }) => {
  if (!show) return null
  return children
}

export default LoginView
