export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-primary">字见</a>
          <div className="flex gap-6 text-sm">
            <a href="/dashboard" className="hover:text-primary transition">总览</a>
            <a href="/learn" className="hover:text-primary transition">学习</a>
            <a href="/convert" className="hover:text-primary transition">转换</a>
            <a href="/wordbooks" className="hover:text-primary transition">字书</a>
            <a href="/scan" className="hover:text-primary transition">实物识字</a>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
