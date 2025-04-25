"use client"

import { useEffect, useRef } from "react"

interface AudioWaveProps {
  audioLevel: number
  className?: string
}

export function AudioWave({ audioLevel, className = "" }: AudioWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set up dimensions
    const width = canvas.width
    const height = canvas.height
    const centerY = height / 2

    // Draw wave
    ctx.beginPath()
    ctx.moveTo(0, centerY)

    const amplitude = Math.max(2, audioLevel * height * 0.4)
    const frequency = 0.05
    const phase = Date.now() * 0.005

    for (let x = 0; x < width; x++) {
      const y = centerY + Math.sin(x * frequency + phase) * amplitude
      ctx.lineTo(x, y)
    }

    // Style and stroke
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"
    ctx.lineWidth = 2
    ctx.stroke()
  }, [audioLevel])

  return <canvas ref={canvasRef} width={60} height={20} className={`${className}`} />
}
