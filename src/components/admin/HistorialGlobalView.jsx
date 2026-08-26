import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Download,
  Filter,
  RefreshCw,
  Eye,
  Pencil,
  FileSpreadsheet,
  Layers,
  MapPin,
  Clock,
  User,
  BookOpen,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Users,
  Check,
  Save,
  AlertCircle,
  Hash,
  FileText
} from 'lucide-react'
import { obtenerHistorialGlobal, actualizarValidacionSesion, editarSesionAdmin } from '../../services/adminApi'

const AULAS_OPTIONS = [
  'BLOQUE R-207',
  'LABORATORIO R-205',
  'LABORATORIO R-206',
  'BLOQUE R-303',
  'BLOQUE R-308',
  'BLOQUE R-315',
  'BLOQUE R-3016',
  'BLOQUE R-317',
  'BLOQUE R-408',
  'BLOQUE R-415',
  'BLOQUE R-416',
  'BLOQUE R-417',
  'SUELOS S-206',
  'SUELOS S-301',
  'SUELOS S-303',
  'SUELOS S-305',
  'SUELOS S-306',
  'SUELOS S-307',
  'Laboratorio de Física',
  'Laboratorio de Química',
  'Laboratorio de Mecánica de Suelos',
  'Laboratorio de Concreto',
  'Laboratorio de Pavimentos',
  'Laboratorio de Estructuras',
  'Laboratorio de Hidráulica',
  'Gabinete de Topografía',
  'Laboratorio BIM'
]

// Función auxiliar para verificar si una sesión está validada
const isSesionValidada = (val) => {
  if (!val) return false
  const str = String(val).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return str.includes('VALID') || str === 'SI' || str === 'APROBADO'
}

const HistorialGlobalView = ({ isDarkMode }) => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSemana, setSelectedSemana] = useState('')
  const [selectedTipo, setSelectedTipo] = useState('')
  const [selectedValidacion, setSelectedValidacion] = useState('')

  // Modales
  const [selectedSesion, setSelectedSesion] = useState(null) // Modal Detalle (Lectura)
  const [editingSesion, setEditingSesion] = useState(null)   // Modal Edición
  const [savingEdit, setSavingEdit] = useState(false)

  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)

  // Cargar datos
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await obtenerHistorialGlobal({
        semana: selectedSemana
      })
      if (res.success && Array.isArray(res.data)) {
        setData(res.data)
      }
    } catch (err) {
      console.error('Error al cargar historial global:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedSemana])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Manejar el toggle manual de validación por la Directora (Switch)
  const handleToggleValidacion = async (row, e) => {
    if (e) e.stopPropagation()
    const currentlyValid = isSesionValidada(row.validacion)
    const nuevoEstado = currentlyValid ? 'PENDIENTE' : 'VÁLIDO'

    // Actualización optimista inmediata en el estado de la UI
    setData((prevData) =>
      prevData.map((item) =>
        item.id === row.id ||
        (item.dni === row.dni && item.fecha === row.fecha && item.horaInicio === row.horaInicio)
          ? { ...item, validacion: nuevoEstado }
          : item
      )
    )

    // Enviar cambio al backend de Google Sheets
    try {
      await actualizarValidacionSesion({
        rowId: row.id,
        dni: row.dni,
        fecha: row.fecha,
        horaInicio: row.horaInicio,
        validacion: nuevoEstado
      })
    } catch (err) {
      console.warn('Error al actualizar validación en Sheets:', err)
    }
  }

  // Abrir modal de edición
  const handleStartEdit = (row, e) => {
    if (e) e.stopPropagation()
    setEditingSesion({
      ...row,
      dniOriginal: row.dni,
      fechaOriginal: row.fecha,
      horaInicioOriginal: row.horaInicio
    })
  }

  // Guardar cambios de edición de sesión
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingSesion) return
    setSavingEdit(true)

    // Actualización optimista local
    setData((prevData) =>
      prevData.map((item) =>
        item.id === editingSesion.id ||
        (item.dni === editingSesion.dniOriginal &&
         item.fecha === editingSesion.fechaOriginal &&
         item.horaInicio === editingSesion.horaInicioOriginal)
          ? { ...editingSesion }
          : item
      )
    )

    try {
      await editarSesionAdmin(editingSesion)
    } catch (err) {
      console.warn('Error al persistir edición en Sheets:', err)
    } finally {
      setSavingEdit(false)
      setEditingSesion(null)
    }
  }

  // Filtrado en cliente
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Búsqueda por texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const match =
          String(item.docente || '').toLowerCase().includes(term) ||
          String(item.dni || '').toLowerCase().includes(term) ||
          String(item.asignatura || '').toLowerCase().includes(term) ||
          String(item.aula || '').toLowerCase().includes(term) ||
          String(item.tema || '').toLowerCase().includes(term)
        if (!match) return false
      }

      // Filtro tipo
      if (selectedTipo && !String(item.tipoSesion || '').toLowerCase().includes(selectedTipo.toLowerCase())) {
        return false
      }

      // Filtro validación
      if (selectedValidacion) {
        const isValid = isSesionValidada(item.validacion)
        if (selectedValidacion === 'VALIDO' && !isValid) return false
        if (selectedValidacion === 'PENDIENTE' && isValid) return false
      }

      return true
    })
  }, [data, searchTerm, selectedTipo, selectedValidacion])

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage))
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredData.slice(start, start + itemsPerPage)
  }, [filteredData, currentPage, itemsPerPage])

  // Exportar a CSV
  const handleExportCSV = () => {
    if (filteredData.length === 0) return
    const headers = [
      'N°',
      'DNI',
      'Docente',
      'Facultad',
      'Escuela',
      'Aula',
      'Fecha',
      'Asignatura',
      'Unidad',
      'Semana',
      'Tema',
      'Hora Inicio',
      'Hora Fin',
      'Estudiantes',
      'Tipo Sesion',
      'Validacion'
    ]

    const rows = filteredData.map((s) => [
      `"${s.numero || ''}"`,
      `"${s.dni || ''}"`,
      `"${s.docente || ''}"`,
      `"${s.facultad || ''}"`,
      `"${s.escuela || ''}"`,
      `"${s.aula || ''}"`,
      `"${s.fecha || ''}"`,
      `"${s.asignatura || ''}"`,
      `"${s.unidad || ''}"`,
      `"${s.semana || ''}"`,
      `"${(s.tema || '').replace(/"/g, '""')}"`,
      `"${s.horaInicio || ''}"`,
      `"${s.horaFin || ''}"`,
      `"${s.numEstudiantes || ''}"`,
      `"${s.tipoSesion || ''}"`,
      `"${s.validacion || ''}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `historial_docente_epic_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header & Controles */}
      <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  Historial Global de Sesiones
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {filteredData.length} registros
                </span>
              </div>
              <p className="text-xs text-white/50 font-medium">
                Auditoría y edición completa de todas las sesiones registradas en la Base de Datos
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportCSV}
              disabled={filteredData.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 transition-all text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel (CSV)</span>
            </button>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refrescar</span>
            </button>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros Rápidos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Buscar docente, curso, tema..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white placeholder:text-white/30 text-xs font-medium focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Filtro Semana */}
          <div>
            <select
              value={selectedSemana}
              onChange={(e) => {
                setSelectedSemana(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Todas las Semanas</option>
              {[...Array(18)].map((_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  Semana {i + 1}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo de Sesión */}
          <div>
            <select
              value={selectedTipo}
              onChange={(e) => {
                setSelectedTipo(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Todos los Tipos</option>
              <option value="Regular">Clase Regular</option>
              <option value="Recupera">Recuperación</option>
            </select>
          </div>

          {/* Filtro Validación */}
          <div>
            <select
              value={selectedValidacion}
              onChange={(e) => {
                setSelectedValidacion(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Todas las Validaciones</option>
              <option value="VALIDO">Validadas</option>
              <option value="PENDIENTE">Pendientes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Registros */}
      <div className="rounded-3xl bg-white/[0.02] border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-black/40 text-[11px] uppercase tracking-wider text-white/50 border-b border-white/10 font-black">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Docente</th>
                <th className="py-3.5 px-4">Aula</th>
                <th className="py-3.5 px-4">Fecha</th>
                <th className="py-3.5 px-4">Asignatura</th>
                <th className="py-3.5 px-4">Sem.</th>
                <th className="py-3.5 px-4">Horario</th>
                <th className="py-3.5 px-4">Est.</th>
                <th className="py-3.5 px-4">Estado Validación</th>
                <th className="py-3.5 px-4 text-center">Validar (Directora)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-white/40">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    Cargando historial de sesiones...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-white/40">
                    No se encontraron registros que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const isValid = isSesionValidada(row.validacion)

                  return (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-white/[0.04] transition-colors group cursor-pointer"
                      onClick={() => setSelectedSesion(row)}
                      title="Clic en la fila para ver detalle completo"
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-white/40">
                        {row.numero || (currentPage - 1) * itemsPerPage + idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white leading-tight group-hover:text-emerald-300 transition-colors">
                          {row.docente}
                        </div>
                        <div className="text-[10px] font-mono text-white/30">
                          {row.dni}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white font-mono text-[11px]">
                          {row.aula}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-white/70">
                        {row.fecha}
                      </td>
                      <td className="py-3 px-4 max-w-[200px] truncate text-slate-200" title={row.asignatura}>
                        {row.asignatura}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-mono font-bold text-[10px]">
                          S{row.semana}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-white/60">
                        {row.horaInicio} ➔ {row.horaFin}
                      </td>
                      <td className="py-3 px-4 font-mono text-center text-white/80">
                        {row.numEstudiantes || '--'}
                      </td>

                      {/* Badge de Validación */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <motion.span
                          key={isValid ? 'valido' : 'pendiente'}
                          initial={{ scale: 0.85, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs ${
                            isValid
                              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-emerald-950/60 ring-1 ring-emerald-500/20'
                              : 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-amber-950/60 ring-1 ring-amber-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isValid ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                            }`}
                          />
                          <span>{isValid ? 'VÁLIDO' : 'PENDIENTE'}</span>
                        </motion.span>
                      </td>

                      {/* Switch Button Interactivo + Botón Lápiz para Editar */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleToggleValidacion(row, e)}
                            className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                              isValid
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400/80 shadow-md shadow-emerald-900/50'
                                : 'bg-black/60 border-white/20 hover:border-amber-400/50 shadow-inner'
                            }`}
                            title={isValid ? 'Válido (Clic para marcar Pendiente)' : 'Pendiente (Clic para Validar)'}
                          >
                            <motion.span
                              layout
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className={`pointer-events-none inline-flex h-4.5 w-4.5 transform items-center justify-center rounded-full shadow-md transition-transform duration-300 ${
                                isValid
                                  ? 'translate-x-6 bg-white text-emerald-600'
                                  : 'translate-x-0.5 bg-slate-400/80 text-black'
                              }`}
                            >
                              {isValid ? (
                                <Check className="w-3 h-3 stroke-[3]" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              )}
                            </motion.span>
                          </button>

                          {/* Botón LÁPIZ para Editar Sesión */}
                          <button
                            onClick={(e) => handleStartEdit(row, e)}
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 hover:text-blue-200 border border-blue-500/30 transition-all cursor-pointer shadow-xs"
                            title="Editar datos de la sesión"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-white/40">
            Mostrando {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} a{' '}
            {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length} registros
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-white/80 font-bold px-2">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: DETALLE DE LA SESIÓN (LECTURA AL HACER CLIC EN LA FILA) ─── */}
      <AnimatePresence>
        {selectedSesion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSesion(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-lg rounded-3xl bg-[#111827] border border-white/20 p-6 shadow-2xl text-white space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Sesión N° {selectedSesion.numero}
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">
                    {selectedSesion.docente}
                  </h3>
                  <p className="text-xs text-white/40 font-mono">DNI: {selectedSesion.dni}</p>
                </div>
                <button
                  onClick={() => setSelectedSesion(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                  <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Asignatura</p>
                  <p className="font-bold text-slate-200">{selectedSesion.asignatura}</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-white/40 text-[10px]">Aula</p>
                    <p className="font-bold">{selectedSesion.aula}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-white/40 text-[10px]">Fecha</p>
                    <p className="font-bold font-mono">{selectedSesion.fecha}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-white/40 text-[10px]">Semana / Unidad</p>
                    <p className="font-bold font-mono">S{selectedSesion.semana} • U{selectedSesion.unidad}</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                  <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Tema Dictado</p>
                  <p className="text-slate-300 leading-relaxed">{selectedSesion.tema || 'Sin tema especificado'}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-white/40 text-[10px]">Horario</p>
                    <p className="font-bold font-mono">{selectedSesion.horaInicio} ➔ {selectedSesion.horaFin}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-white/40 text-[10px]">Estudiantes</p>
                    <p className="font-bold">{selectedSesion.numEstudiantes || '0'} asistentes</p>
                  </div>
                </div>

                {selectedSesion.observaciones && (
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                    <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Observaciones</p>
                    <p className="text-slate-300 italic">{selectedSesion.observaciones}</p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                <button
                  onClick={() => {
                    const toEdit = selectedSesion
                    setSelectedSesion(null)
                    handleStartEdit(toEdit)
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar Sesión</span>
                </button>

                <button
                  onClick={() => setSelectedSesion(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 2: EDICIÓN COMPLETA DE LA SESIÓN (LÁPIZ) ─── */}
      <AnimatePresence>
        {editingSesion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingSesion(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-2xl rounded-3xl bg-[#0f172a] border border-blue-500/40 p-6 shadow-2xl text-white space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar"
            >
              {/* Header Modal Edición */}
              <div className="flex items-start justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      Editar Registro de Sesión
                    </h3>
                    <p className="text-xs text-white/40">
                      Modificación directa por Dirección Académica
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingSesion(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Formulario de Edición */}
              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                {/* Docente & DNI */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Nombre del Docente</label>
                    <input
                      type="text"
                      value={editingSesion.docente || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, docente: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">DNI del Docente</label>
                    <input
                      type="text"
                      value={editingSesion.dni || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, dni: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Asignatura */}
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">Asignatura y Sección</label>
                  <input
                    type="text"
                    value={editingSesion.asignatura || ''}
                    onChange={(e) => setEditingSesion({ ...editingSesion, asignatura: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                {/* Aula, Fecha, Semana, Unidad */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Aula / Laboratorio</label>
                    <input
                      type="text"
                      list="aulas-list"
                      value={editingSesion.aula || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, aula: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                      required
                    />
                    <datalist id="aulas-list">
                      {AULAS_OPTIONS.map((a, i) => (
                        <option key={i} value={a} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={editingSesion.fecha || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, fecha: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Semana</label>
                    <select
                      value={editingSesion.semana || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, semana: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      {[...Array(18)].map((_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          Semana {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Unidad</label>
                    <select
                      value={editingSesion.unidad || 'I'}
                      onChange={(e) => setEditingSesion({ ...editingSesion, unidad: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      <option value="I">Unidad I</option>
                      <option value="II">Unidad II</option>
                      <option value="III">Unidad III</option>
                    </select>
                  </div>
                </div>

                {/* Tema Programado */}
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">Tema Programado en el Sílabo</label>
                  <textarea
                    rows={2}
                    value={editingSesion.tema || ''}
                    onChange={(e) => setEditingSesion({ ...editingSesion, tema: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    placeholder="Descripción del tema dictado..."
                  />
                </div>

                {/* Horarios, Estudiantes, Tipo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Hora Inicio</label>
                    <input
                      type="text"
                      value={editingSesion.horaInicio || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, horaInicio: e.target.value })}
                      placeholder="HH:mm:ss"
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Hora Fin</label>
                    <input
                      type="text"
                      value={editingSesion.horaFin || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, horaFin: e.target.value })}
                      placeholder="HH:mm:ss"
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">N° Estudiantes</label>
                    <input
                      type="number"
                      value={editingSesion.numEstudiantes || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, numEstudiantes: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Tipo de Sesión</label>
                    <select
                      value={editingSesion.tipoSesion || 'Clase Regular'}
                      onChange={(e) => setEditingSesion({ ...editingSesion, tipoSesion: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      <option value="Clase Regular">Clase Regular</option>
                      <option value="Recuperación">Recuperación</option>
                    </select>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">Observaciones</label>
                  <input
                    type="text"
                    value={editingSesion.observaciones || ''}
                    onChange={(e) => setEditingSesion({ ...editingSesion, observaciones: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    placeholder="Observaciones de la clase..."
                  />
                </div>

                {/* Botones de Acción */}
                <div className="pt-3 border-t border-white/10 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingSesion(null)}
                    disabled={savingEdit}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-900/40 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {savingEdit ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando en Sheets...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar Cambios</span>
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

export default HistorialGlobalView
