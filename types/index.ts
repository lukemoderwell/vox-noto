export interface Position {
  x: number
  y: number
}

export interface Note {
  id: string
  content: string
  rawTranscription?: string
  position: Position
  color: string
  createdAt: string
}
