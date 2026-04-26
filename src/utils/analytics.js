/**
 * Google Analytics 4 with privacy-first Consent Mode v2.
 *
 * Hard no-ops unless ALL of:
 *   - VITE_BUILD_TARGET === 'web'    (skip Electron)
 *   - VITE_GA_ID is set              (skip if env unset)
 *   - user has granted consent       (skip until ConsentBanner accepts)
 *
 * gtag.js is loaded dynamically the first time consent is granted — never
 * via a static <script> tag in index.html. This keeps the empty-state
 * bundle clean and ensures users who decline never load any GA code.
 */

const CONSENT_KEY = 'analytics-consent-v1'
const GA_ID = import.meta.env.VITE_GA_ID
const IS_WEB = import.meta.env.VITE_BUILD_TARGET === 'web'

let initialized = false
let pendingEvents = []

export function getConsent() {
  if (typeof localStorage === 'undefined') return null
  const v = localStorage.getItem(CONSENT_KEY)
  return v === 'granted' || v === 'denied' ? v : null
}

export function setConsent(value) {
  if (value !== 'granted' && value !== 'denied') return
  try {
    localStorage.setItem(CONSENT_KEY, value)
  } catch {
    // Private mode / quota — non-fatal.
  }
  if (value === 'granted') {
    initAnalytics()
    track('app_view')
  }
}

export function isAnalyticsAvailable() {
  return IS_WEB && !!GA_ID
}

export function initAnalytics() {
  if (initialized) return
  if (!IS_WEB || !GA_ID) return
  if (getConsent() !== 'granted') return

  initialized = true

  // Set up the dataLayer + gtag stub before the script loads. Consent Mode
  // v2 starts with everything denied; we then update analytics_storage to
  // granted (the user has just clicked Accept).
  window.dataLayer = window.dataLayer || []
  window.gtag = function () {
    window.dataLayer.push(arguments)
  }

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  })

  window.gtag('consent', 'update', {
    analytics_storage: 'granted',
  })

  window.gtag('js', new Date())
  window.gtag('config', GA_ID, {
    anonymize_ip: true,
    send_page_view: true,
  })

  // Inject the gtag.js script. Async so it doesn't block anything.
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  document.head.appendChild(s)

  // Flush any track() calls that arrived before init.
  for (const [name, params] of pendingEvents) {
    window.gtag('event', name, params)
  }
  pendingEvents = []
}

export function track(eventName, params) {
  if (!IS_WEB || !GA_ID) return
  if (getConsent() !== 'granted') return
  if (!initialized) {
    pendingEvents.push([eventName, params || {}])
    return
  }
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params || {})
  }
}
