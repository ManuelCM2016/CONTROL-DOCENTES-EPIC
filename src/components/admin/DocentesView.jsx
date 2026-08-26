import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Search,
  BookOpen,
  GraduationCap,
  Building,
  RefreshCw,
  Award,
  ChevronRight,
  ShieldCheck,
  Pencil,
  Plus,
  X,
  Save,
  Check,
  Building2,
  School,
  Sparkles,
  Tag
} from 'lucide-react'
import { obtenerListaDocentes, editarDocenteAdmin } from '../../services/adminApi'

const DocentesView = ({ isDarkMode }) => {
  const [docentes, setDocentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Modal de Edición / Creación de Docente
  const [editingDocente, setEditingDocente] = useState(null)
  const [newCursoInput, setNewCursoInput] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchDocentes = async (isManual = false) => {
    if (isManual) setRefreshing(true)
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
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDocentes()
  }, [])

  // Abrir modal de edición
  const handleStartEdit = (doc) => {
    setEditingDocente({
      dniOriginal: doc.dni,
      dni: doc.dni,
      codigo: doc.codigo || '',
      nombre: doc.nombre || '',
      facultad: doc.facultad || 'FAING',
      escuela: doc.escuela || 'EPIC',
      carrera: doc.carrera || 'Ingeniería Civil',
      cursos: Array.isArray(doc.cursos) ? [...doc.cursos] : (doc.cursos ? String(doc.cursos).split(',').map(c => c.trim()) : [])
    })
    setNewCursoInput('')
  }

  // Abrir modal para nuevo docente
  const handleAddNew = () => {
    setEditingDocente({
      dniOriginal: '',
      dni: '',
      codigo: '',
      nombre: '',
      facultad: 'FAING',
      escuela: 'EPIC',
      carrera: 'Ingeniería Civil',
      cursos: []
    })
    setNewCursoInput('')
  }

  // Agregar curso a la lista en el modal
  const handleAddCurso = () => {
    if (!newCursoInput.trim()) return
    const cursoTrimmed = newCursoInput.trim()
    if (!editingDocente.cursos.includes(cursoTrimmed)) {
      setEditingDocente({
        ...editingDocente,
        cursos: [...editingDocente.cursos, cursoTrimmed]
      })
    }
    setNewCursoInput('')
  }

  // Eliminar curso de la lista en el modal
  const handleRemoveCurso = (indexToRemove) => {
    setEditingDocente({
      ...editingDocente,
      cursos: editingDocente.cursos.filter((_, idx) => idx !== indexToRemove)
    })
  }

  // Guardar cambios en el backend y localmente
  const handleSaveDocente = async (e) => {
    e.preventDefault()
    if (!editingDocente || !editingDocente.dni.trim() || !editingDocente.nombre.trim()) return

    setSaving(true)

    const payload = {
      dniOriginal: editingDocente.dniOriginal,
      nuevoDni: editingDocente.dni.trim(),
      dni: editingDocente.dni.trim(),
      codigo: editingDocente.codigo.trim(),
      nombre: editingDocente.nombre.trim(),
      facultad: editingDocente.facultad.trim(),
      escuela: editingDocente.escuela.trim(),
      carrera: editingDocente.carrera.trim(),
      cursos: editingDocente.cursos
    }

    // Actualización optimista local
    setDocentes((prev) => {
      const exists = prev.some((d) => d.dni === payload.dniOriginal || d.dni === payload.dni)
      if (exists) {
        return prev.map((d) =>
          d.dni === payload.dniOriginal || d.dni === payload.dni
            ? { ...d, ...payload }
            : d
        )
      } else {
        return [payload, ...prev]
      }
    })

    try {
      await editarDocenteAdmin(payload)
    } catch (err) {
      console.warn('Error al guardar docente en Sheets:', err)
    } finally {
      setSaving(false)
      setEditingDocente(null)
    }
  }

  // Filtrar docentes por búsqueda
  const filteredDocentes = docentes.filter((d) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      (d.nombre || '').toLowerCase().includes(term) ||
      (d.dni || '').includes(term) ||
      (d.codigo && d.codigo.toLowerCase().includes(term)) ||
      (d.facultad && d.facultad.toLowerCase().includes(term)) ||
      (d.escuela && d.escuela.toLowerCase().includes(term)) ||
      (d.carrera && d.carrera.toLowerCase().includes(term)) ||
      (d.cursos || []).some((c) => c.toLowerCase().includes(term))
    )
  })

  return (
    <div className="space-y-6">
      {/* Header Superior & Controles */}
      <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">
                Directorio Oficial de Docentes
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {filteredDocentes.length} Docentes Registrados
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">
              Maestro institucional con atributos completos y asignaturas para el inicio de sesión
            </p>
          </div>
        </div>

        {/* Búsqueda y Botones de Acción */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por DNI, nombre, curso..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white placeholder:text-white/30 text-xs font-medium focus:outline-none focus:border-purple-500/50"
            />
          </div>

          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 transition-all text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Docente</span>
          </button>

          <button
            onClick={() => fetchDocentes(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Lista de Docentes */}
      {loading ? (
        <div className="py-20 text-center text-white/40">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
          Cargando directorio de docentes desde Google Sheets...
        </div>
      ) : filteredDocentes.length === 0 ? (
        <div className="py-20 text-center text-white/40 rounded-3xl bg-white/[0.02] border border-white/10">
          No se encontraron docentes con ese criterio de búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredDocentes.map((doc, idx) => (
            <motion.div
              key={doc.dni || idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.25) }}
              className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-purple-500/50 transition-all duration-300 flex flex-col justify-between space-y-3.5 shadow-lg group relative"
            >
              {/* Fila Superior: Datos de Identificación & Botón Editar */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono text-[10px] text-white/70 font-bold">
                      DNI: {doc.dni}
                    </span>
                    {doc.codigo && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 font-mono text-[10px] text-purple-300 font-bold">
                        CÓD: {doc.codigo}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white leading-snug group-hover:text-purple-200 transition-colors">
                    {doc.nombre}
                  </h3>
                </div>

                {/* Botón Editar Docente */}
                <button
                  onClick={() => handleStartEdit(doc)}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 hover:border-purple-500/50 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs shrink-0"
                  title="Editar datos y cursos del docente"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Editar</span>
                </button>
              </div>

              {/* Atributos Institucionales: Facultad, Escuela, Carrera */}
              <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-2xl bg-black/40 border border-white/5 text-[11px]">
                <div>
                  <span className="text-white/40 block text-[9px] uppercase font-bold tracking-wider">Facultad</span>
                  <span className="font-semibold text-slate-200 truncate block">{doc.facultad || 'FAING'}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[9px] uppercase font-bold tracking-wider">Escuela</span>
                  <span className="font-semibold text-purple-300 truncate block">{doc.escuela || 'EPIC'}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[9px] uppercase font-bold tracking-wider">Carrera</span>
                  <span className="font-semibold text-slate-200 truncate block">{doc.carrera || 'Ingeniería Civil'}</span>
                </div>
              </div>

              {/* Asignaturas / Cursos Asignados (Diseño Visual Elegante) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-white/40 uppercase">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-purple-400" />
                    Cursos Asignados ({doc.cursos?.length || 0})
                  </span>
                  <span className="text-[9px] font-normal normal-case text-white/30">Visibles para su login</span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                  {(doc.cursos || []).length === 0 ? (
                    <span className="text-[11px] text-white/30 italic">Sin cursos asignados</span>
                  ) : (
                    (doc.cursos || []).map((curso, cIdx) => {
                      // Separar código de curso si existe (ej. CI-462 o INE-365)
                      const parts = curso.split(' - ')
                      const code = parts[0] || curso
                      const name = parts[1] || ''

                      return (
                        <div
                          key={cIdx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-950/30 hover:bg-purple-950/60 border border-purple-500/25 hover:border-purple-400/50 text-[11px] text-slate-200 transition-all shadow-xs"
                        >
                          <span className="font-mono font-bold text-purple-300 text-[10px] bg-purple-500/20 px-1 rounded">
                            {code}
                          </span>
                          {name && <span className="truncate max-w-[200px]">{name}</span>}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ─── MODAL: EDITAR / REGISTRAR DOCENTE ─── */}
      <AnimatePresence>
        {editingDocente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingDocente(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-2xl rounded-3xl bg-[#0f172a] border border-purple-500/40 p-6 shadow-2xl text-white space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar"
            >
              {/* Header Modal */}
              <div className="flex items-start justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {editingDocente.dniOriginal ? 'Editar Docente y Asignaturas' : 'Registrar Nuevo Docente'}
                    </h3>
                    <p className="text-xs text-white/40">
                      Actualización del maestro oficial en Google Sheets
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingDocente(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Formulario */}
              <form onSubmit={handleSaveDocente} className="space-y-4 text-xs">
                {/* DNI, Código & Nombre */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">DNI (Usuario Login)</label>
                    <input
                      type="text"
                      value={editingDocente.dni || ''}
                      onChange={(e) => setEditingDocente({ ...editingDocente, dni: e.target.value })}
                      placeholder="8 dígitos"
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Código Docente (Opcional)</label>
                    <input
                      type="text"
                      value={editingDocente.codigo || ''}
                      onChange={(e) => setEditingDocente({ ...editingDocente, codigo: e.target.value })}
                      placeholder="Ej. D001"
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Facultad</label>
                    <input
                      type="text"
                      value={editingDocente.facultad || 'FAING'}
                      onChange={(e) => setEditingDocente({ ...editingDocente, facultad: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Nombre Completo */}
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">Nombre Completo y Grado Académico</label>
                  <input
                    type="text"
                    value={editingDocente.nombre || ''}
                    onChange={(e) => setEditingDocente({ ...editingDocente, nombre: e.target.value })}
                    placeholder="Ej. MTRO. LIPA FLORES JOSEPH CRISTHIAN"
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                {/* Escuela y Carrera */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Escuela Profesional</label>
                    <input
                      type="text"
                      value={editingDocente.escuela || 'EPIC'}
                      onChange={(e) => setEditingDocente({ ...editingDocente, escuela: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Carrera</label>
                    <input
                      type="text"
                      value={editingDocente.carrera || 'Ingeniería Civil'}
                      onChange={(e) => setEditingDocente({ ...editingDocente, carrera: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Editor Dinámico de Cursos */}
                <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                      Cursos Asignados ({editingDocente.cursos?.length || 0})
                    </label>
                    <span className="text-[10px] text-white/40">Presione enter o clic en Agregar</span>
                  </div>

                  {/* Input para añadir curso */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCursoInput}
                      onChange={(e) => setNewCursoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCurso()
                        }
                      }}
                      placeholder="Ej. CI-462 RESISTENCIA DE MATERIALES I - A"
                      className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white text-xs font-medium focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCurso}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </button>
                  </div>

                  {/* Chips de cursos agregados */}
                  <div className="flex flex-wrap gap-2 pt-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {editingDocente.cursos.map((curso, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-slate-200 text-xs shadow-xs"
                      >
                        <span className="font-mono text-purple-300 font-bold">{curso}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCurso(idx)}
                          className="p-0.5 rounded-full hover:bg-red-500/20 text-white/50 hover:text-red-300 transition-colors cursor-pointer"
                          title="Eliminar curso"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botones */}
                <div className="pt-3 border-t border-white/10 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingDocente(null)}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-900/40 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando en Sheets...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar Docente</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DocentesView
