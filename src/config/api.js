/**
 * Configuración de la API del Sistema de Control Docente EPIC
 * 
 * INSTRUCCIONES:
 * 1. Despliega tu Code.gs como Aplicación Web en Google Apps Script
 * 2. Copia la URL generada y pégala aquí abajo
 * 3. La URL tiene el formato: https://script.google.com/macros/s/AKfycb.../exec
 */

// ── URL de la API de Google Apps Script ──
// Dejar vacío ('') para usar datos mock locales (modo desarrollo)
// Pegar la URL real para conectar con Google Sheets (modo producción)
export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz8D3fIP_JzHEX21qFvr_3gF_YLdLEjFNVPxI9KiEV0Uek4UgKurI35MIi0M5njMHJe/exec'

// ── Modo de operación ──
// true = usa siempre mock data (sin importar si hay URL)
// false = usa la API si hay URL, mock data si no hay
export const FORCE_MOCK = false

// ── Timeout para peticiones fetch (ms) ──
export const API_TIMEOUT = 15000
