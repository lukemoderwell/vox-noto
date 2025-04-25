"use client"

import { FileText, FileCode, Info, Filter, AudioWaveformIcon as Waveform } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RecordingToggle } from "./recording-toggle"

interface ToolbarProps {
  isRecording: boolean
  toggleRecording: () => void
  selectedColor: string
  setSelectedColor: (color: string) => void
  isProcessing: boolean
  showRawTranscription: boolean
  toggleRawTranscription: () => void
  contentQuality?: { score: number; reason: string } | null
  filteredCount?: number
  audioLevel?: number
}

export function Toolbar({
  isRecording,
  toggleRecording,
  selectedColor,
  setSelectedColor,
  isProcessing,
  showRawTranscription,
  toggleRawTranscription,
  contentQuality,
  filteredCount = 0,
  audioLevel = 0,
}: ToolbarProps) {
  // Format content quality score as a percentage
  const qualityScorePercent = contentQuality ? Math.round(contentQuality.score * 100) : null

  return (
    <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        {/* Recording Toggle Switch */}
        <RecordingToggle
          isRecording={isRecording}
          onToggle={toggleRecording}
          disabled={isProcessing}
          audioLevel={audioLevel}
        />

        {isProcessing && (
          <div className="flex items-center text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            <Waveform className="h-3 w-3 mr-2 animate-pulse" />
            Processing...
          </div>
        )}

        {contentQuality && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`text-xs px-2 py-1 rounded-full flex items-center ${
                    contentQuality.score >= 0.15 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  <Filter className="h-3 w-3 mr-1" />
                  {qualityScorePercent}%
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-xs">
                  Content quality score: {qualityScorePercent}%<br />
                  {contentQuality.reason}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {filteredCount > 0 && (
          <span className="text-xs text-gray-500">
            {filteredCount} segment{filteredCount !== 1 ? "s" : ""} filtered
          </span>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Info className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-xs">
                Using relaxed content analysis to capture speech as concise, direct notes without attribution phrases.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleRawTranscription}
          className={showRawTranscription ? "bg-gray-100" : ""}
        >
          {showRawTranscription ? (
            <>
              <FileCode className="h-4 w-4 mr-1" /> Hide Raw
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-1" /> Show Raw
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
