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
export const obtenerMonitoreo = async () => {
  if (!GOOGLE_SCRIPT_URL) {
    return { success: true, data: { fecha: new Date().toISOString().split('T')[0], activas: [], completadasHoy: [], todosDocentes: [] } }
  }
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=monitoreo`
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
