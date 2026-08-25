import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Mail, Lock, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { ADMIN_USERS, ADMIN_PASSWORD } from '../../config/adminConfig'

const AdminLoginView = ({ onAdminLogin, onBack, isDarkMode }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Ingrese su correo electrónico')
      return
    }
    if (!password.trim()) {
      setError('Ingrese su contraseña')
      return
    }

    setIsLoading(true)

    // Simular delay de autenticación
    await new Promise((r) => setTimeout(r, 800))

    const emailNorm = email.trim().toLowerCase()
    const isAuthorized = ADMIN_USERS.some((u) => u.email.toLowerCase() === emailNorm)
    const isPasswordCorrect = password === ADMIN_PASSWORD

    if (isAuthorized && isPasswordCorrect) {
      const user = ADMIN_USERS.find((u) => u.email.toLowerCase() === emailNorm)
      onAdminLogin({ email: emailNorm, nombre: user.nombre })
    } else {
      setError('Credenciales inválidas. Acceso restringido.')
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 30%, #161b22 60%, #0d1117 100%)',
      }}
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.1, 1] }}
          transition={{ rotate: { duration: 60, repeat: Infinity, ease: 'linear' }, scale: { duration: 8, repeat: Infinity } }}
          className="absolute -top-1/2 -right-1/4 w-[80%] h-full"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{ rotate: -360, scale: [1, 1.15, 1] }}
          transition={{ rotate: { duration: 50, repeat: Infinity, ease: 'linear' }, scale: { duration: 10, repeat: Infinity } }}
          className="absolute -bottom-1/2 -left-1/4 w-[80%] h-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Back button */}
      <motion.button
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={onBack}
        className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all text-sm font-medium cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver al Login</span>
      </motion.button>

      {/* Card */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="rounded-3xl border-2 overflow-hidden bg-white/[0.04] backdrop-blur-2xl border-white/10 shadow-2xl shadow-black/60">
          {/* Top accent — azul para admin */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600" />

          <div className="p-8 sm:p-10">
            {/* Header */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center mb-8"
            >
              <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-lg ring-4 bg-gradient-to-br from-blue-700 to-indigo-900 shadow-blue-900/30 ring-blue-700/20">
                <Shield className="w-10 h-10 text-blue-200" />
              </div>
              <h1 className="font-bold text-base tracking-wider mb-1 text-white">
                PANEL DE DIRECCIÓN
              </h1>
              <div className="h-px w-40 mx-auto my-2.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
              <p className="text-xs font-bold tracking-wide text-blue-300/70">
                ESCUELA PROFESIONAL DE INGENIERÍA CIVIL
              </p>
              <p className="text-[10px] mt-1.5 tracking-widest uppercase font-medium text-white/30">
                Acceso restringido — Coordinación Académica
              </p>
            </motion.div>

            {/* Form */}
            <motion.form
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* Email */}
              <div>
                <label className="block text-xs font-bold tracking-wider uppercase mb-2 ml-1 text-white/50">
                  Correo Institucional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-white/30" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError('') }}
                    placeholder="correo@virtual.upt.pe"
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm font-medium tracking-wide bg-white/[0.06] text-white placeholder:text-white/20 border-2 border-white/10 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all"
                    autoComplete="email"
                    autoFocus
                    id="admin-email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold tracking-wider uppercase mb-2 ml-1 text-white/50">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-white/30" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError('') }}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-12 py-3.5 rounded-xl text-sm font-medium tracking-wider bg-white/[0.06] text-white placeholder:text-white/20 border-2 border-white/10 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all"
                    autoComplete="current-password"
                    id="admin-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20"
                  >
                    <Shield className="w-4 h-4 text-red-400 shrink-0" />
                    <p className="text-xs font-semibold text-red-400">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isLoading || !email.trim() || !password.trim()}
                className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer ${
                  email.trim() && password.trim() && !isLoading
                    ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-lg shadow-blue-900/30 hover:shadow-xl hover:from-blue-600 hover:to-indigo-600'
                    : 'bg-white/[0.05] text-white/30 cursor-not-allowed border border-white/5'
                }`}
                id="btn-admin-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verificando credenciales...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Acceder al Panel</span>
                  </>
                )}
              </motion.button>
            </motion.form>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="mt-6 text-center"
            >
              <p className="text-[10px] text-white/15 tracking-wider font-medium">
                Sistema de Control Docente EPIC — Acceso Administrativo
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default AdminLoginView
