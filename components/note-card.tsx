"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Trash2, Move, Maximize2, Minimize2 } from "lucide-react"
import type { Note, Position } from "@/types"
import { ColorPicker } from "@/components/color-picker"

interface NoteCardProps {
  note: Note
  isSelected: boolean
  onSelect: () => void
  onContentChange: (content: string) => void
  onPositionChange: (position: Position) => void
  onColorChange: (color: string) => void
  onDelete: () => void
  showRawTranscription?: boolean
  zoomLevel?: number
}

export function NoteCard({
  note,
  isSelected,
  onSelect,
  onContentChange,
  onPositionChange,
  onColorChange,
  onDelete,
  showRawTranscription = false,
  zoomLevel = 1,
}: NoteCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const noteRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const lastPositionRef = useRef<Position>(note.position)

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [note.content, expanded])

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (noteRef.current) {
      const rect = noteRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
      setIsDragging(true)
      onSelect()
    }
  }

  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && noteRef.current) {
        const canvasRect = noteRef.current.parentElement?.parentElement?.getBoundingClientRect()
        if (canvasRect) {
          // Calculate new position considering zoom level
          const newX = (e.clientX - canvasRect.left - dragOffset.x) / zoomLevel
          const newY = (e.clientY - canvasRect.top - dragOffset.y) / zoomLevel

          // Only update if position has changed significantly to avoid unnecessary updates
          if (
            Math.abs(newX - lastPositionRef.current.x) > 1 / zoomLevel ||
            Math.abs(newY - lastPositionRef.current.y) > 1 / zoomLevel
          ) {
            lastPositionRef.current = { x: newX, y: newY }
            onPositionChange({ x: newX, y: newY })
          }
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset, onPositionChange, zoomLevel])

  // Update lastPositionRef when note.position changes from outside
  useEffect(() => {
    lastPositionRef.current = note.position
  }, [note.position])

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showColorPicker && colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showColorPicker])

  // Handle color selection
  const handleColorSelect = (color: string) => {
    onColorChange(color)
    setShowColorPicker(false)
  }

  // Calculate width based on zoom level and expanded state
  const width = expanded ? 384 : 256 // 96rem or 64rem

  return (
    <div
      ref={noteRef}
      data-note-id={note.id}
      className={`absolute rounded-lg shadow-lg overflow-hidden transition-all ${
        note.color
      } ${isSelected ? "shadow-xl ring-2 ring-blue-500" : ""}`}
      style={{
        left: `${note.position.x}px`,
        top: `${note.position.y}px`,
        width: `${width}px`,
        zIndex: isSelected ? 10 : 1,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <div
        className="h-6 cursor-move flex items-center justify-between px-2 bg-opacity-20 bg-black"
        onMouseDown={handleMouseDown}
      >
        <Move className="h-3 w-3 text-gray-600" />
        <div className="flex items-center space-x-1">
          <button
            className="text-gray-600 hover:text-gray-800"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          <button
            className="relative"
            onClick={(e) => {
              e.stopPropagation()
              setShowColorPicker(!showColorPicker)
            }}
          >
            <div
              className="h-3 w-3 rounded-full cursor-pointer hover:ring-2 ring-white"
              style={{ backgroundColor: note.color.replace("bg-", "") }}
            />
            {showColorPicker && (
              <div ref={colorPickerRef} className="absolute right-0 mt-1 z-30" onClick={(e) => e.stopPropagation()}>
                <ColorPicker selectedColor={note.color} onColorSelect={handleColorSelect} />
              </div>
            )}
          </button>
          <button
            className="text-gray-600 hover:text-red-500"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="w-full p-3 focus:outline-none resize-none bg-transparent"
        value={note.content}
        onChange={(e) => {
          onContentChange(e.target.value)
        }}
        style={{ minHeight: expanded ? "120px" : "80px" }}
        placeholder="Type your note here..."
        onClick={(e) => e.stopPropagation()}
      />

      {/* Show raw transcription if enabled and available */}
      {showRawTranscription && note.rawTranscription && (
        <div className="px-3 pb-2 pt-1 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-500 mb-1">Raw Transcription:</div>
          <div className="text-xs text-gray-600 italic max-h-20 overflow-y-auto">{note.rawTranscription}</div>
        </div>
      )}

      <div className="text-xs text-gray-500 px-3 pb-2">{new Date(note.createdAt).toLocaleString()}</div>
    </div>
  )
}
