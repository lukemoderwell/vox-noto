"use client"

import { ZoomIn, ZoomOut, Maximize } from "lucide-react"

interface ZoomControlsProps {
  zoomLevel: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export function ZoomControls({ zoomLevel, onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  return (
    <div className="bg-white rounded-md shadow-md border border-gray-200 p-1 flex flex-col">
      <button className="p-1 hover:bg-gray-100 rounded" onClick={onZoomIn} title="Zoom In (Ctrl/Cmd +)">
        <ZoomIn className="h-5 w-5 text-gray-600" />
      </button>
      <div className="text-xs text-center py-1 border-t border-b border-gray-200">{Math.round(zoomLevel * 100)}%</div>
      <button className="p-1 hover:bg-gray-100 rounded" onClick={onZoomOut} title="Zoom Out (Ctrl/Cmd -)">
        <ZoomOut className="h-5 w-5 text-gray-600" />
      </button>
      <button
        className="p-1 hover:bg-gray-100 rounded border-t border-gray-200"
        onClick={onReset}
        title="Reset Zoom (Ctrl/Cmd 0)"
      >
        <Maximize className="h-5 w-5 text-gray-600" />
      </button>
    </div>
  )
}
