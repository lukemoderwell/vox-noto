"use client"

import { useEffect, useRef } from "react"

interface AudioVisualizerProps {
  audioLevel: number
}

export function AudioVisualizer({ audioLevel }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Draw the audio visualizer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set up dimensions
    const width = canvas.width
    const height = canvas.height
    const barWidth = 4
    const barSpacing = 2
    const barCount = Math.floor(width / (barWidth + barSpacing))
    const centerY = height / 2

    // Draw background
    ctx.fillStyle = "#f3f4f6"
    ctx.fillRect(0, 0, width, height)

    // Draw audio level bars
    ctx.fillStyle = audioLevel > 0.1 ? "#10b981" : "#d1d5db"

    for (let i = 0; i < barCount; i++) {
      // Calculate bar height based on position and audio level
      // Create a wave-like pattern
      const x = i * (barWidth + barSpacing)
      const multiplier = 0.5 + Math.sin(i * 0.2 + Date.now() * 0.005) * 0.5
      const barHeight = Math.max(2, audioLevel * height * 0.8 * multiplier)

      // Draw the bar centered vertically
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight)
    }
  }, [audioLevel])

  return <canvas ref={canvasRef} width={800} height={40} className="w-full h-10 rounded" />
}
