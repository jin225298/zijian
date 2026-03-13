export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">字见</h1>
        <p className="text-xl text-muted-foreground mb-8">
          智能汉字学习平台 · 结合 AI 与实物识字
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
          >
            开始学习
          </a>
          <a
            href="/register"
            className="px-6 py-3 border border-border rounded-lg hover:bg-muted transition"
          >
            注册账号
          </a>
        </div>
      </div>
    </main>
  )
}
