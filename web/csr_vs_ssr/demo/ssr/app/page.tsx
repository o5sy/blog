import MetricsPanel from './MetricsPanel'

interface Post {
  id: number
  title: string
  body: string
  imageUrl: string
}

const API_DELAY = process.env.API_DELAY ?? 0

async function getPosts(): Promise<Post[]> {
  const res = await fetch(`http://localhost:4000/api/posts?delay=${API_DELAY}`, {
    cache: 'no-store',
  })
  return res.json()
}

export default async function Home() {
  const posts = await getPosts()

  return (
    <div>
      <h1>SSR Demo</h1>

      <MetricsPanel apiDelay={Number(API_DELAY)} />

      <section>
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
      </section>
    </div>
  )
}
