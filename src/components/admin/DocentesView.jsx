import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Search,
  BookOpen,
  GraduationCap,
  Building,
  RefreshCw,
  Award,
  ChevronRight,
  ShieldCheck
} from 'lucide-react'
import { obtenerListaDocentes } from '../../services/adminApi'

const DocentesView = ({ isDarkMode }) => {
  const [docentes, setDocentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchDocentes = async () => {
    setLoading(true)
    try {
      const res = await obtenerListaDocentes()
      if (res.success && Array.isArray(res.data)) {
        setDocentes(res.data)
      }
    } catch (err) {
      console.error('Error al cargar docentes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocentes()
  }, [])

  const filteredDocentes = docentes.filter((d) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      d.nombre.toLowerCase().includes(term) ||
      d.dni.includes(term) ||
      (d.codigo && d.codigo.toLowerCase().includes(term)) ||
      (d.cursos || []).some((c) => c.toLowerCase().includes(term))
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">
                Plana Docente Institucional
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {docentes.length} Docentes
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">
              Maestro oficial de docentes y asignaturas adscritas a la EPIC - UPT
            </p>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar docente o asignatura..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white placeholder:text-white/30 text-xs font-medium focus:outline-none focus:border-purple-500/50"
          />
        </div>
      </div>

      {/* Grid de Tarjetas de Docentes */}
      {loading ? (
        <div className="py-20 text-center text-white/40">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
          Cargando directorio de docentes...
        </div>
      ) : filteredDocentes.length === 0 ? (
        <div className="py-20 text-center text-white/40">
          No se encontraron docentes con ese criterio de búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocentes.map((doc, idx) => (
            <motion.div
              key={doc.dni || idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
              className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-purple-500/40 transition-all duration-300 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono text-[10px] text-white/50">
                    DNI: {doc.dni}
                  </span>
                  {doc.codigo && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 font-mono text-[10px] text-purple-300 font-bold">
                      CÓD: {doc.codigo}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-black text-white leading-tight mb-1">
                  {doc.nombre}
                </h3>
                <p className="text-[11px] text-white/40">
                  {doc.escuela || 'Ingeniería Civil'}
                </p>
              </div>

              {/* Cursos Asignados */}
              <div className="space-y-1.5 pt-3 border-t border-white/10">
                <p className="text-[10px] uppercase font-bold tracking-wider text-white/40 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-purple-400" />
                  Asignaturas ({doc.cursos?.length || 0})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(doc.cursos || []).map((curso, cIdx) => (
                    <span
                      key={cIdx}
                      className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-[10px] font-medium text-slate-300 leading-snug"
                    >
                      {curso}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DocentesView
