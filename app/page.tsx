import { Canvas } from "@/components/canvas"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex flex-col flex-1">
        <Canvas />
      </div>
    </main>
  )
}
