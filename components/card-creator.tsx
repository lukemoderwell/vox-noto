"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/color-picker"
import { PlusCircle, X, AlertCircle } from "lucide-react"
import type { Note } from "@/types"
import { generateUniqueId } from "@/lib/utils"

interface CardCreatorProps {
  selectedColor: string
  onColorSelect: (color: string) => void
  onAddCard: (note: Note) => void
}

export function CardCreator({ selectedColor, onColorSelect, onAddCard }: CardCreatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState("")
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [duplicateError, setDuplicateError] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  // Clear error timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }
    }
  }, [])

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

  const handleAddCard = () => {
    if (content.trim()) {
      const newNote: Note = {
        id: generateUniqueId(),
        content: content.trim(),
        position: { x: 0, y: 0 }, // Position will be set by the Canvas component
        color: selectedColor,
        createdAt: new Date().toISOString(),
      }

      const prevNoteCount = document.querySelectorAll("[data-note-id]").length

      onAddCard(newNote)

      // Check if the note was actually added by comparing note counts
      // This is a simple way to detect if the duplicate check prevented the note from being added
      setTimeout(() => {
        const currentNoteCount = document.querySelectorAll("[data-note-id]").length
        if (currentNoteCount === prevNoteCount) {
          // Note wasn't added, likely due to duplicate detection
          setDuplicateError(true)

          if (errorTimeoutRef.current) {
            clearTimeout(errorTimeoutRef.current)
          }

          errorTimeoutRef.current = setTimeout(() => {
            setDuplicateError(false)
          }, 3000)
        } else {
          // Note was added successfully
          setContent("")
          setIsOpen(false)
        }
      }, 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault()
      handleAddCard()
    }
    // Close on Escape
    if (e.key === "Escape") {
      setIsOpen(false)
      setContent("")
    }
  }

  return (
    <div className="fixed right-0 top-1/2 transform -translate-y-1/2 z-30">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-l-full rounded-r-none h-12 px-3 bg-white hover:bg-gray-100 text-gray-800 border-gray-200 border shadow-md"
          variant="outline"
        >
          <PlusCircle className="h-5 w-5 mr-1" />
          <span className="sr-only">Add Card</span>
        </Button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-l-lg shadow-lg w-72 overflow-hidden">
          <div className="flex justify-between items-center p-3 border-b border-gray-200">
            <h3 className="font-medium">Add New Card</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setIsOpen(false)
                setContent("")
                setDuplicateError(false)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-3">
            {duplicateError && (
              <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>Similar content already exists on the canvas.</span>
              </div>
            )}

            <textarea
              ref={textareaRef}
              className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${selectedColor}`}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (duplicateError) setDuplicateError(false)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter card content..."
              rows={3}
              style={{ minHeight: "80px" }}
            />

            <div className="flex justify-between items-center mt-3">
              <div className="relative">
                <div
                  className="h-6 w-6 rounded-full cursor-pointer border border-gray-300"
                  style={{ backgroundColor: selectedColor.replace("bg-", "") }}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                />
                {showColorPicker && (
                  <div ref={colorPickerRef} className="absolute left-0 mt-1 z-40">
                    <ColorPicker
                      selectedColor={selectedColor}
                      onColorSelect={(color) => {
                        onColorSelect(color)
                        setShowColorPicker(false)
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false)
                    setContent("")
                    setDuplicateError(false)
                  }}
                >
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={handleAddCard} disabled={!content.trim()}>
                  Add Card
                </Button>
              </div>
            </div>

            <div className="text-xs text-gray-500 mt-2">Tip: Press Ctrl+Enter to add card</div>
          </div>
        </div>
      )}
    </div>
  )
}
