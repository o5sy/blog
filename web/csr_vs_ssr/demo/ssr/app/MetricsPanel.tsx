'use client'

import { useEffect, useState } from 'react'
import { onFCP, onLCP, onTTFB } from 'web-vitals'

interface Metrics {
  ttfb?: number
  fcp?: number
  lcp?: number
}

export default function MetricsPanel({ apiDelay }: { apiDelay: number }) {
  const [metrics, setMetrics] = useState<Metrics>({})

  useEffect(() => {
    onTTFB((m) => setMetrics((prev) => ({ ...prev, ttfb: Math.round(m.value) })))
    onFCP((m) => setMetrics((prev) => ({ ...prev, fcp: Math.round(m.value) })))
    onLCP((m) => setMetrics((prev) => ({ ...prev, lcp: Math.round(m.value) })))
  }, [])

  return (
    <section className="metrics">
      <h2>Web Vitals</h2>
      <table>
        <thead>
          <tr><th>지표</th><th>값</th></tr>
        </thead>
        <tbody>
          <tr><td>TTFB</td><td>{metrics.ttfb != null ? `${metrics.ttfb}ms` : '측정 중…'}</td></tr>
          <tr><td>FCP</td><td>{metrics.fcp != null ? `${metrics.fcp}ms` : '측정 중…'}</td></tr>
          <tr><td>LCP</td><td>{metrics.lcp != null ? `${metrics.lcp}ms` : '측정 중…'}</td></tr>
        </tbody>
      </table>
      <p className="note">API delay: {apiDelay}ms</p>
    </section>
  )
}
