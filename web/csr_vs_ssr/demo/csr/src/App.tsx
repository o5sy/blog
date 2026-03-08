import { useEffect, useState } from 'react'
import { onFCP, onLCP, onTTFB } from 'web-vitals'
import './App.css'

interface Post {
  id: number
  title: string
  body: string
  imageUrl: string
}

interface Metrics {
  ttfb?: number
  fcp?: number
  lcp?: number
}

const API_DELAY = import.meta.env.VITE_API_DELAY ?? 0

function App() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<Metrics>({})

  useEffect(() => {
    onTTFB((m) => setMetrics((prev) => ({ ...prev, ttfb: Math.round(m.value) })))
    onFCP((m) => setMetrics((prev) => ({ ...prev, fcp: Math.round(m.value) })))
    onLCP((m) => setMetrics((prev) => ({ ...prev, lcp: Math.round(m.value) })))
  }, [])

  useEffect(() => {
    fetch(`http://localhost:4000/api/posts?delay=${API_DELAY}`)
      .then((r) => r.json())
      .then((data) => {
        setPosts(data)
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <section className="metrics">
        <h2>Web Vitals (CSR)</h2>
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
        <p className="note">API delay: {API_DELAY}ms</p>
      </section>

      <section>
        {loading ? (
          <p className="loading">Loading…</p>
        ) : (
          <ul className="card-list">
            {posts.map((post) => (
              <li key={post.id} className="card">
                <img src={post.imageUrl} alt={post.title} width={800} height={400} />
                <div className="card-body">
                  <strong>{post.title}</strong>
                  <p>{post.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default App
