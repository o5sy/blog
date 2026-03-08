import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 4000

app.use(cors())

const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626']

const POSTS = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  title: `Post ${i + 1}`,
  body: `This is the body of post ${i + 1}. Lorem ipsum dolor sit amet.`,
  imageUrl: `http://localhost:4000/img/${i + 1}`,
  color: COLORS[i % COLORS.length],
}))

// GET /api/posts?delay=2000
app.get('/api/posts', async (req, res) => {
  const delay = Number(req.query.delay) || 0
  await new Promise((r) => setTimeout(r, delay))
  res.json(POSTS)
})

// GET /img/:id → SVG 이미지 반환 (외부 의존성 없이 큰 이미지 역할)
app.get('/img/:id', (req, res) => {
  const id = Number(req.query.id) || Number(req.params.id) || 1
  const color = COLORS[(id - 1) % COLORS.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">
    <rect width="800" height="400" fill="${color}"/>
    <text x="400" y="220" font-size="48" font-family="sans-serif" text-anchor="middle" fill="white">Post ${id}</text>
  </svg>`
  res.setHeader('Content-Type', 'image/svg+xml')
  res.send(svg)
})

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`)
})
