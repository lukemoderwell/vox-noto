"use client"

import { useState, useEffect } from "react"
import { Mic } from "lucide-react"
import { cn } from "@/lib/utils"

interface RecordingToggleProps {
  isRecording: boolean
  onToggle: () => void
  disabled?: boolean
  audioLevel?: number
}

export function RecordingToggle({ isRecording, onToggle, disabled = false, audioLevel = 0 }: RecordingToggleProps) {
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; size: number; opacity: number }[]>([])
  const [sparkleCount, setSparkleCount] = useState(0)

  // Generate sparkle effects when recording
  useEffect(() => {
    if (!isRecording) {
      setSparkles([])
      return
    }

    const interval = setInterval(() => {
      // Add a new sparkle at a random position
      const newSparkle = {
        id: sparkleCount,
        x: Math.random() * 100, // Random position (0-100%)
        y: Math.random() * 100, // Random position (0-100%)
        size: 0.5 + Math.random() * 1.5, // Random size
        opacity: 0.7 + Math.random() * 0.3, // Random opacity
      }

      setSparkles((prev) => [...prev, newSparkle])
      setSparkleCount((prev) => prev + 1)

      // Remove old sparkles to prevent memory issues
      if (sparkles.length > 15) {
        setSparkles((prev) => prev.slice(1))
      }
    }, 300)

    return () => clearInterval(interval)
  }, [isRecording, sparkleCount, sparkles.length])

  // Animate sparkles
  useEffect(() => {
    if (!isRecording || sparkles.length === 0) return

    const animationFrame = requestAnimationFrame(() => {
      setSparkles((prev) =>
        prev
          .map((sparkle) => ({
            ...sparkle,
            size: sparkle.size * 0.95,
            opacity: Math.max(0, sparkle.opacity - 0.02),
          }))
          .filter((sparkle) => sparkle.opacity > 0),
      )
    })

    return () => cancelAnimationFrame(animationFrame)
  }, [isRecording, sparkles])

  return (
    <div className="flex items-center space-x-3">
      <Mic
        className={cn("h-5 w-5 transition-colors duration-200", isRecording ? "text-purple-500" : "text-gray-500")}
      />

      <button
        onClick={onToggle}
        disabled={disabled}
        className="relative h-6 w-12 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        aria-pressed={isRecording}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {/* Toggle background */}
        <div
          className={cn(
            "absolute inset-0 rounded-full transition-colors duration-200",
            isRecording ? "bg-gradient-to-r from-purple-600 to-pink-600" : "bg-gray-200",
          )}
        >
          {/* Sparkle effects for recording state */}
          {isRecording &&
            sparkles.map((sparkle) => (
              <span
                key={sparkle.id}
                className="absolute rounded-full bg-white"
                style={{
                  left: `${sparkle.x}%`,
                  top: `${sparkle.y}%`,
                  width: `${sparkle.size}px`,
                  height: `${sparkle.size}px`,
                  opacity: sparkle.opacity,
                }}
              />
            ))}
        </div>

        {/* Toggle knob */}
        <div
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200",
            isRecording && "translate-x-6",
          )}
        >
          {/* Pulse effect when recording */}
          {isRecording && <span className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-75"></span>}
        </div>
      </button>

      <span
        className={cn(
          "text-sm font-medium transition-colors duration-200",
          isRecording ? "text-purple-600" : "text-gray-500",
        )}
      >
        {isRecording ? "Recording" : "Off"}
      </span>
    </div>
  )
}
