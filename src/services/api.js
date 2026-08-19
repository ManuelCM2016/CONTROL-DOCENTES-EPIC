import { GOOGLE_SCRIPT_URL, FORCE_MOCK, API_TIMEOUT } from '../config/api'
import { findDocente } from '../utils/mockData'

/**
 * Verifica si debe usarse el modo mock (local) o la API real
 */
const shouldUseMock = () => FORCE_MOCK || !GOOGLE_SCRIPT_URL

/**
 * Wrapper de fetch con timeout y manejo especial para Google Apps Script.
 * GAS responde con un redirect 302, por lo que necesitamos redirect: 'follow'.
 */
const fetchGAS = async (url, options = {}) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

  try {
    const response = await fetch(url, {
      ...options,
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Verifique su conexión a internet.')
    }
    throw error
  }
}

// ══════════════════════════════════════════
// BUSCAR DOCENTE (GET)
// ══════════════════════════════════════════

/**
 * Busca un docente por DNI o Código.
 * - Si hay URL configurada → llama a Google Apps Script
 * - Si no → usa mock data local
 * 
 * @param {string} identifier - DNI o código del docente
 * @returns {Promise<{success: boolean, data?: object, message?: string}>}
 */
export const buscarDocente = async (identifier) => {
  // ── Modo Mock (desarrollo) ──
  if (shouldUseMock()) {
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const found = findDocente(identifier)
    if (found) {
      return { success: true, data: found }
    }
    return { success: false, message: 'Docente no encontrado. Verifique su DNI o código.' }
  }

  // ── Modo API Real (producción) ──
  try {
    const url = `${GOOGLE_SCRIPT_URL}?id=${encodeURIComponent(identifier)}`
    const response = await fetchGAS(url)
    
    // Verificar si la respuesta es OK
    if (!response.ok) {
      throw new Error(`Error del servidor (HTTP ${response.status})`)
    }

    const text = await response.text()
    
    // Intentar parsear el JSON
    try {
      const result = JSON.parse(text)
      return result
    } catch (parseError) {
      console.error('Respuesta no JSON:', text.substring(0, 200))
      throw new Error('El servidor devolvió una respuesta inválida.')
    }
  } catch (error) {
    console.error('Error al buscar docente:', error)
    return {
      success: false,
      message: error.message || 'Error de conexión con el servidor.',
    }
  }
}

// ══════════════════════════════════════════
// REGISTRAR SESIÓN (POST)
// ══════════════════════════════════════════

/**
 * Envía los datos de la sesión a Google Sheets.
 * - Si hay URL configurada → POST a Google Apps Script
 * - Si no → simula éxito con mock
 * 
 * Google Apps Script requiere:
 * - Content-Type: text/plain (para evitar preflight CORS)
 * - Body como JSON.stringify
 * 
 * @param {object} sessionData - Datos completos de la sesión
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const registrarSesion = async (sessionData) => {
  // ── Modo Mock (desarrollo) ──
  if (shouldUseMock()) {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    console.log('📋 [MOCK] Datos que se enviarían a Google Sheets:', sessionData)
    return { success: true, message: 'Sesión registrada exitosamente (modo local).' }
  }

  // ── Modo API Real (producción) ──
  try {
    const response = await fetchGAS(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(sessionData),
    })

    if (!response.ok) {
      throw new Error(`Error del servidor (HTTP ${response.status})`)
    }

    const text = await response.text()
    
    try {
      const result = JSON.parse(text)
      return result
    } catch (parseError) {
      console.error('Respuesta no JSON:', text.substring(0, 200))
      throw new Error('Error al procesar respuesta del servidor.')
    }
  } catch (error) {
    console.error('Error al registrar sesión:', error)
    return {
      success: false,
      message: error.message || 'Error al enviar los datos al servidor.',
    }
  }
}
