export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden dark bg-[var(--background)] text-[var(--foreground)]">
      {children}
    </div>
  )
}
