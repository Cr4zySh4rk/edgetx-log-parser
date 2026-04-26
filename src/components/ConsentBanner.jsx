import { useEffect, useState } from 'react'
import { getConsent, setConsent, isAnalyticsAvailable } from '../utils/analytics'

/**
 * One-time consent banner for GA4. Renders nothing if:
 *   - Analytics is unavailable (desktop build, or no VITE_GA_ID)
 *   - User has already chosen (granted or denied) — choice is in localStorage
 *
 * Accept / Decline are equal-weight; no dark patterns.
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)
  const [showPolicy, setShowPolicy] = useState(false)

  useEffect(() => {
    if (!isAnalyticsAvailable()) return
    if (getConsent() !== null) return
    setVisible(true)
  }, [])

  if (!visible) return null

  const choose = value => {
    setConsent(value)
    setVisible(false)
  }

  return (
    <div className="consent-banner" role="dialog" aria-label="Analytics consent">
      <p className="consent-copy">
        Anonymous analytics help me improve the tool. Your flight logs are
        never sent — only which features you used.{' '}
        <button
          type="button"
          className="consent-policy-toggle"
          onClick={() => setShowPolicy(s => !s)}
          aria-expanded={showPolicy}
        >
          {showPolicy ? 'Hide privacy details' : 'Privacy'}
        </button>
      </p>

      {showPolicy && (
        <p className="consent-policy">
          <strong>Collected:</strong> page views, clicks on the sample-flight
          button, view-mode toggles between Classic and 3D Globe.{' '}
          <strong>Not collected:</strong> the CSV content, GPS coordinates,
          flight paths, or anything else from your log file.
        </p>
      )}

      <div className="consent-actions">
        <button type="button" className="consent-btn" onClick={() => choose('denied')}>
          Decline
        </button>
        <button type="button" className="consent-btn" onClick={() => choose('granted')}>
          Accept
        </button>
      </div>
    </div>
  )
}
