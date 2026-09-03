import { GOOGLE_SCRIPT_URL, API_TIMEOUT } from '../config/api'

/**
 * Wrapper de fetch con timeout para Google Apps Script
 */
const fetchGAS = async (url, options = {}) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)
  try {
    const response = await fetch(url, { ...options, redirect: 'follow', signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') throw new Error('La solicitud tardó demasiado.')
    throw error
  }
}

// ──────────────────────────────────────────────────
// REGISTRO DE INICIO DE CLASE (POST action=inicio)
// Envía datos básicos al iniciar la sesión
// ──────────────────────────────────────────────────
export const registrarInicioClase = async (payload) => {
  if (!GOOGLE_SCRIPT_URL) return { success: true, message: 'Mock: inicio registrado.' }
  try {
    const response = await fetchGAS(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ ...payload, action: 'inicio' }),
    })
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    console.warn('Error al registrar inicio de clase (no crítico):', error)
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// REGISTRO DE CIERRE DE CLASE (POST action=cierre)
// Completa el registro con todos los datos al finalizar
// ──────────────────────────────────────────────────
export const registrarCierreClase = async (payload) => {
  if (!GOOGLE_SCRIPT_URL) return { success: true, message: 'Mock: cierre registrado.' }
  try {
    const response = await fetchGAS(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ ...payload, action: 'cierre' }),
    })
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    console.warn('Error al registrar cierre de clase:', error)
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// MONITOREO EN VIVO (GET action=monitoreo)
// ──────────────────────────────────────────────────
export const obtenerMonitoreo = async (fechaFiltro = '') => {
  const hoyLocal = fechaFiltro || new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local
  if (!GOOGLE_SCRIPT_URL) {
    return { success: true, data: { fecha: hoyLocal, activas: [], completadasHoy: [], todosDocentes: [] } }
  }
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=monitoreo&fecha=${encodeURIComponent(hoyLocal)}`
    const response = await fetchGAS(url)
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// ESTADÍSTICAS (GET action=estadisticas)
// ──────────────────────────────────────────────────
export const obtenerEstadisticas = async (filtros = {}) => {
  if (!GOOGLE_SCRIPT_URL) {
    return { success: true, data: { kpis: {}, graficos: {} } }
  }
  try {
    const params = new URLSearchParams({ action: 'estadisticas', ...filtros }).toString()
    const url = `${GOOGLE_SCRIPT_URL}?${params}`
    const response = await fetchGAS(url)
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// HISTORIAL GLOBAL (GET action=historial_global)
// ──────────────────────────────────────────────────
export const obtenerHistorialGlobal = async (filtros = {}) => {
  if (!GOOGLE_SCRIPT_URL) {
    return { success: true, data: [] }
  }
  try {
    const params = new URLSearchParams({ action: 'historial_global', ...filtros }).toString()
    const url = `${GOOGLE_SCRIPT_URL}?${params}`
    const response = await fetchGAS(url)
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// LISTA DE DOCENTES (GET action=lista_docentes)
// ──────────────────────────────────────────────────
export const obtenerListaDocentes = async () => {
  if (!GOOGLE_SCRIPT_URL) {
    return { success: true, data: [] }
  }
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=lista_docentes`
    const response = await fetchGAS(url)
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// EDITAR SESIÓN COMPLETA (POST action=editar_sesion)
// Permite a la Directora modificar cualquier dato de una sesión
// ──────────────────────────────────────────────────
export const editarSesionAdmin = async (payload) => {
  if (!GOOGLE_SCRIPT_URL) return { success: true, message: 'Mock: sesión editada.' }
  try {
    const response = await fetchGAS(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ ...payload, action: 'editar_sesion' }),
    })
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    console.warn('Error al editar sesión:', error)
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// EDITAR O AGREGAR DOCENTE (POST action=editar_docente)
// Permite a la Directora editar los datos y cursos de un docente
// ──────────────────────────────────────────────────
export const editarDocenteAdmin = async (payload) => {
  if (!GOOGLE_SCRIPT_URL) return { success: true, message: 'Mock: docente editado.' }
  try {
    const response = await fetchGAS(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ ...payload, action: 'editar_docente' }),
    })
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    console.warn('Error al editar docente:', error)
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// ACTUALIZAR VALIDACIÓN (POST action=validar)
// Permite a la Directora cambiar manualmente de PENDIENTE a VÁLIDO
// ──────────────────────────────────────────────────
export const actualizarValidacionSesion = async (payload) => {
  if (!GOOGLE_SCRIPT_URL) return { success: true, message: 'Mock: validación actualizada.' }
  try {
    const response = await fetchGAS(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ ...payload, action: 'validar' }),
    })
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    console.warn('Error al actualizar validación:', error)
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// FORZAR CIERRE DE AULA (POST action=forzar_cierre)
// Calcula hora fin = horaInicio + duracionEstimadaMin
// ──────────────────────────────────────────────────
export const forzarCierreSesionAdmin = async (payload) => {
  if (!GOOGLE_SCRIPT_URL) return { success: true, message: 'Mock: cierre forzado.' }
  try {
    const response = await fetchGAS(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ ...payload, action: 'forzar_cierre' }),
    })
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    console.warn('Error al forzar cierre de aula:', error)
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// ANULAR INICIO DE CLASE (POST action=anular_inicio)
// Elimina la fila ACTIVA del docente
// ──────────────────────────────────────────────────
export const anularInicioClase = async (payload) => {
  if (!GOOGLE_SCRIPT_URL) return { success: true, message: 'Mock: inicio anulado.' }
  try {
    const response = await fetchGAS(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ ...payload, action: 'anular_inicio' }),
    })
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    console.warn('Error al anular inicio de clase:', error)
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// OBTENER HORARIOS DEL SEMESTRE (GET action=obtener_horarios)
// Devuelve todos los horarios cargados
// ──────────────────────────────────────────────────
export const obtenerHorarios = async () => {
  if (!GOOGLE_SCRIPT_URL) return { success: true, data: { horarios: [], mensaje: 'Mock: sin horarios.' } }
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=obtener_horarios`
    const response = await fetchGAS(url)
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    console.warn('Error al obtener horarios:', error)
    return { success: false, message: error.message }
  }
}

// ──────────────────────────────────────────────────
// OBTENER HORARIO DE UN DOCENTE (GET action=horario_docente)
// Para autocompletado en el panel del docente
// ──────────────────────────────────────────────────
export const obtenerHorarioDocente = async (dni) => {
  if (!GOOGLE_SCRIPT_URL) return { success: true, data: { horarios: [] } }
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=horario_docente&dni=${encodeURIComponent(dni)}`
    const response = await fetchGAS(url)
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    console.warn('Error al obtener horario del docente:', error)
    return { success: false, data: { horarios: [] } }
  }
}

// ──────────────────────────────────────────────────
// CARGAR HORARIOS DEL SEMESTRE (POST action=cargar_horarios)
// Envía todos los registros de horarios procesados al backend
// ──────────────────────────────────────────────────
export const cargarHorariosSemestre = async (horarios) => {
  if (!GOOGLE_SCRIPT_URL) return { success: true, message: 'Mock: horarios cargados.' }
  try {
    // Timeout más largo para carga masiva (120s)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: controller.signal,
      body: JSON.stringify({ action: 'cargar_horarios', horarios }),
    })
    clearTimeout(timeoutId)
    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    console.warn('Error al cargar horarios:', error)
    if (error.name === 'AbortError') return { success: false, message: 'La carga tardó demasiado. Intenta con menos registros.' }
    return { success: false, message: error.message }
  }
}
