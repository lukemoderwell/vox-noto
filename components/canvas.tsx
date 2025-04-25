"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { NoteCard } from "@/components/note-card"
import { Toolbar } from "@/components/toolbar"
import { AudioVisualizer } from "@/components/audio-visualizer"
import { useAudioTranscription } from "@/hooks/use-audio-transcription"
import type { Note, Position } from "@/types"
import { generateUniqueId } from "@/lib/utils"
import { isSimilarToExisting } from "@/lib/text-utils"
import { ZoomIn, ZoomOut, Maximize } from "lucide-react"

export function Canvas() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string>("bg-yellow-100")
  const [isRecording, setIsRecording] = useState(false)
  const [showRawTranscription, setShowRawTranscription] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1) // 1 = 100% zoom
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }) // For panning the canvas
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isSpaceDragging, setIsSpaceDragging] = useState(false)
  const [lastCreatedNoteId, setLastCreatedNoteId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const notesLengthRef = useRef<number>(0) // Reference to track notes length without causing rerenders
  const {
    startRecording,
    stopRecording,
    transcription,
    summary,
    isProcessing,
    audioLevel,
    contentQuality,
    filteredCount,
  } = useAudioTranscription()
  const lastTranscriptionRef = useRef<string>("")
  const lastSummaryRef = useRef<string>("")
  const lastNoteTimeRef = useRef<number>(0)
  const processedContentsRef = useRef<Set<string>>(new Set())

  // Update notesLengthRef when notes change
  useEffect(() => {
    notesLengthRef.current = notes.length
  }, [notes])

  // Start or stop recording based on isRecording state
  useEffect(() => {
    if (isRecording) {
      try {
        startRecording()
        setError(null)
      } catch (err) {
        console.error("Failed to start recording:", err)
        setError("Failed to start recording. Please check microphone permissions.")
        setIsRecording(false)
      }
    } else {
      try {
        stopRecording()
      } catch (err) {
        console.error("Failed to stop recording:", err)
      }
    }
  }, [isRecording, startRecording, stopRecording])

  // Create a new note from summary when it's available
  useEffect(() => {
    if (summary && summary.trim() !== "" && summary !== lastSummaryRef.current) {
      console.log("Checking summary for duplication:", summary)

      // Check for exact duplicates first
      if (processedContentsRef.current.has(summary.trim())) {
        console.log("Exact duplicate detected, skipping note creation")
        return
      }

      // Check for similar content
      const existingContents = notes.map((note) => note.content)
      if (isSimilarToExisting(summary, existingContents)) {
        console.log("Similar content detected, skipping note creation")
        return
      }

      // Check for minimum time between notes (1.5 seconds)
      const now = Date.now()
      const timeSinceLastNote = now - lastNoteTimeRef.current
      if (timeSinceLastNote < 1500) {
        console.log("Note creation too soon after previous note, skipping")
        return
      }

      console.log("Creating new note from summary:", summary)

      // Store the current summary to prevent duplicates
      lastSummaryRef.current = summary
      lastTranscriptionRef.current = transcription
      lastNoteTimeRef.current = now
      processedContentsRef.current.add(summary.trim())

      // Get position for the new note
      const position = getRandomPosition()

      const newNote: Note = {
        id: generateUniqueId(),
        content: summary,
        rawTranscription: transcription, // Store the raw transcription for reference
        position,
        color: selectedColor,
        createdAt: new Date().toISOString(),
      }

      setNotes((prevNotes) => [...prevNotes, newNote])
    }
  }, [summary, transcription, selectedColor, notes])

  // Reset processed contents when recording starts
  useEffect(() => {
    if (isRecording) {
      processedContentsRef.current = new Set()
    }
  }, [isRecording])

  // Focus the newly created note
  useEffect(() => {
    if (lastCreatedNoteId) {
      // Use a small timeout to ensure the DOM has updated
      const timeoutId = setTimeout(() => {
        const noteElement = document.querySelector(`[data-note-id="${lastCreatedNoteId}"] textarea`)
        if (noteElement instanceof HTMLTextAreaElement) {
          noteElement.focus()
          // Place cursor at the end of any existing text
          noteElement.selectionStart = noteElement.value.length
          noteElement.selectionEnd = noteElement.value.length
        }
        // Clear the last created note ID after focusing
        setLastCreatedNoteId(null)
      }, 50)

      return () => clearTimeout(timeoutId)
    }
  }, [lastCreatedNoteId])

  // Get a visible position within the canvas
  const getVisiblePosition = useCallback((): Position => {
    if (!canvasRef.current) return { x: 100, y: 100 }

    const rect = canvasRef.current.getBoundingClientRect()

    // Calculate the center of the visible area
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    // Add some randomness to avoid stacking
    const randomOffsetX = Math.random() * 100 - 50
    const randomOffsetY = Math.random() * 100 - 50

    // Calculate position considering the current zoom level and pan offset
    return {
      x: (centerX + randomOffsetX - panOffset.x) / zoomLevel,
      y: (centerY + randomOffsetY - panOffset.y) / zoomLevel,
    }
  }, [zoomLevel, panOffset])

  // Get a random position within the canvas - no dependencies to avoid recreation
  const getRandomPosition = useCallback((): Position => {
    const canvasWidth = canvasRef.current?.clientWidth || 800
    const canvasHeight = canvasRef.current?.clientHeight || 600

    // Ensure notes are placed in a more organized manner
    // Create a grid-like layout with some randomness
    const columns = Math.floor(canvasWidth / 300)
    const rows = Math.floor(canvasHeight / 200)

    // Use the ref for notes length instead of the state
    const noteCount = notesLengthRef.current
    const column = noteCount % columns
    const row = Math.floor(noteCount / columns) % rows

    // Add some randomness to avoid perfect alignment
    const randomOffsetX = Math.random() * 50 - 25
    const randomOffsetY = Math.random() * 50 - 25

    // Calculate position considering the current zoom level and pan offset
    return {
      x: (column * 300 + 50 + randomOffsetX - panOffset.x) / zoomLevel,
      y: (row * 200 + 50 + randomOffsetY - panOffset.y) / zoomLevel,
    }
  }, [zoomLevel, panOffset]) // Dependencies needed for correct positioning

  // Add a new note at a specific position
  const addNote = useCallback(
    (position: Position) => {
      const newNote: Note = {
        id: generateUniqueId(),
        content: "",
        rawTranscription: "",
        position,
        color: selectedColor,
        createdAt: new Date().toISOString(),
      }

      setNotes((prevNotes) => [...prevNotes, newNote])
      setSelectedNote(newNote.id)
      setLastCreatedNoteId(newNote.id)
    },
    [selectedColor],
  )

  // Quick add a new note in the visible area
  const quickAddNote = useCallback(() => {
    const position = getVisiblePosition()
    addNote(position)
  }, [addNote, getVisiblePosition])

  // Update a note's content
  const updateNoteContent = useCallback((id: string, content: string) => {
    setNotes((prevNotes) => prevNotes.map((note) => (note.id === id ? { ...note, content } : note)))
  }, [])

  // Update a note's position
  const updateNotePosition = useCallback((id: string, position: Position) => {
    setNotes((prevNotes) => prevNotes.map((note) => (note.id === id ? { ...note, position } : note)))
  }, [])

  // Update a note's color
  const updateNoteColor = useCallback((id: string, color: string) => {
    setNotes((prevNotes) => prevNotes.map((note) => (note.id === id ? { ...note, color } : note)))
  }, [])

  // Delete a note
  const deleteNote = useCallback((id: string) => {
    setNotes((prevNotes) => {
      // Remove the content from processed contents when deleting a note
      const noteToDelete = prevNotes.find((note) => note.id === id)
      if (noteToDelete) {
        processedContentsRef.current.delete(noteToDelete.content.trim())
      }

      return prevNotes.filter((note) => note.id !== id)
    })

    setSelectedNote((prev) => (prev === id ? null : prev))
  }, [])

  // Handle canvas click to add a new note or deselect current note
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // If space is pressed, don't deselect notes on click (we're in scroll mode)
      if (isSpacePressed) {
        return
      }

      if (e.target === canvasRef.current || e.target === contentRef.current) {
        setSelectedNote(null)
      }
    },
    [isSpacePressed],
  )

  // Handle canvas double click to add a new note
  const handleCanvasDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Don't add notes when space is pressed
      if (isSpacePressed) {
        return
      }

      if (e.target === canvasRef.current || e.target === contentRef.current) {
        const rect = canvasRef.current?.getBoundingClientRect() || { left: 0, top: 0 }

        // Calculate position considering zoom and pan
        const position = {
          x: (e.clientX - rect.left - panOffset.x) / zoomLevel,
          y: (e.clientY - rect.top - panOffset.y) / zoomLevel,
        }

        addNote(position)
      }
    },
    [addNote, zoomLevel, panOffset, isSpacePressed],
  )

  // Toggle recording state
  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev)
  }, [])

  // Toggle showing raw transcription
  const toggleRawTranscription = useCallback(() => {
    setShowRawTranscription((prev) => !prev)
  }, [])

  // Zoom in function
  const zoomIn = useCallback(() => {
    setZoomLevel((prevZoom) => Math.min(prevZoom + 0.1, 2.0)) // Max zoom: 200%
  }, [])

  // Zoom out function
  const zoomOut = useCallback(() => {
    setZoomLevel((prevZoom) => Math.max(prevZoom - 0.1, 0.5)) // Min zoom: 50%
  }, [])

  // Reset zoom function
  const resetZoom = useCallback(() => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
  }, [])

  // Handle mouse wheel for zooming
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.05 : -0.05
      setZoomLevel((prevZoom) => Math.max(0.5, Math.min(2.0, prevZoom + delta)))
    }
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if we're in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      // 'n' key for quick add note
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        quickAddNote()
      }

      // Space bar pressed
      if (e.code === "Space" && !e.repeat) {
        setIsSpacePressed(true)
        // Change cursor to indicate scroll mode
        if (canvasRef.current) {
          canvasRef.current.style.cursor = "grab"
        }
        // Prevent default space behavior (page scroll)
        e.preventDefault()
      }

      // Zoom in: Ctrl/Cmd + Plus
      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=" || e.code === "Equal")) {
        e.preventDefault()
        zoomIn()
      }
      // Zoom out: Ctrl/Cmd + Minus
      else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault()
        zoomOut()
      }
      // Reset zoom: Ctrl/Cmd + 0
      else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault()
        resetZoom()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // Space bar released
      if (e.code === "Space") {
        setIsSpacePressed(false)
        setIsSpaceDragging(false)
        // Reset cursor
        if (canvasRef.current) {
          canvasRef.current.style.cursor = "default"
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [zoomIn, zoomOut, resetZoom, quickAddNote])

  // Handle mouse down for panning
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Space + left mouse button for directional scrolling
      if (isSpacePressed && e.button === 0) {
        e.preventDefault()
        setIsSpaceDragging(true)
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })

        // Change cursor to indicate active scrolling
        if (canvasRef.current) {
          canvasRef.current.style.cursor = "grabbing"
        }
      }
      // Middle mouse button (button 1) or shift + left mouse button for regular panning
      else if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        e.preventDefault()
        setIsPanning(true)
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
      }
    },
    [panOffset, isSpacePressed],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Handle both regular panning and space+drag scrolling
      if (isPanning || isSpaceDragging) {
        setPanOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        })
      }
    },
    [isPanning, isSpaceDragging, panStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)

    if (isSpaceDragging) {
      setIsSpaceDragging(false)
      // Reset cursor to grab (still in space mode but not dragging)
      if (canvasRef.current && isSpacePressed) {
        canvasRef.current.style.cursor = "grab"
      }
    }
  }, [isSpacePressed, isSpaceDragging])

  // Add event listeners for panning
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsPanning(false)
      setIsSpaceDragging(false)

      // Reset cursor if space is still pressed
      if (canvasRef.current && isSpacePressed) {
        canvasRef.current.style.cursor = "grab"
      }
    }

    window.addEventListener("mouseup", handleGlobalMouseUp)
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp)
    }
  }, [isSpacePressed])

  return (
    <div className="flex flex-col h-screen">
      <Toolbar
        isRecording={isRecording}
        toggleRecording={toggleRecording}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        isProcessing={isProcessing}
        showRawTranscription={showRawTranscription}
        toggleRawTranscription={toggleRawTranscription}
        contentQuality={contentQuality}
        filteredCount={filteredCount}
        audioLevel={audioLevel}
      />

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {isRecording && (
        <div className="bg-gray-100 p-2 border-b border-gray-200">
          <AudioVisualizer audioLevel={audioLevel} />
        </div>
      )}

      <div
        ref={canvasRef}
        className="flex-1 relative bg-gray-50 overflow-hidden"
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: isPanning || isSpaceDragging ? "grabbing" : isSpacePressed ? "grab" : "default" }}
      >
        {/* Zoom controls */}
        <div className="absolute top-4 left-4 z-20 bg-white rounded-md shadow-md border border-gray-200 p-1 flex flex-col">
          <button className="p-1 hover:bg-gray-100 rounded" onClick={zoomIn} title="Zoom In (Ctrl/Cmd +)">
            <ZoomIn className="h-5 w-5 text-gray-600" />
          </button>
          <div className="text-xs text-center py-1 border-t border-b border-gray-200">
            {Math.round(zoomLevel * 100)}%
          </div>
          <button className="p-1 hover:bg-gray-100 rounded" onClick={zoomOut} title="Zoom Out (Ctrl/Cmd -)">
            <ZoomOut className="h-5 w-5 text-gray-600" />
          </button>
          <button
            className="p-1 hover:bg-gray-100 rounded border-t border-gray-200"
            onClick={resetZoom}
            title="Reset Zoom (Ctrl/Cmd 0)"
          >
            <Maximize className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Navigation hint */}
        <div className="absolute bottom-4 left-4 z-20 bg-white/80 backdrop-blur-sm rounded-md shadow-sm border border-gray-200 p-2 text-xs text-gray-600">
          <p>
            Hold <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">Space</kbd> + drag to scroll
          </p>
          <p className="mt-1">
            Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">n</kbd> to add a new note
          </p>
        </div>

        {/* Zoom and pan container */}
        <div
          ref={contentRef}
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
            transformOrigin: "0 0",
          }}
        >
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isSelected={selectedNote === note.id}
              onSelect={() => setSelectedNote(note.id)}
              onContentChange={(content) => updateNoteContent(note.id, content)}
              onPositionChange={(position) => updateNotePosition(note.id, position)}
              onColorChange={(color) => updateNoteColor(note.id, color)}
              onDelete={() => deleteNote(note.id)}
              showRawTranscription={showRawTranscription}
              zoomLevel={zoomLevel}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
