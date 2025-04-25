"use client"

interface ColorPickerProps {
  selectedColor: string
  onColorSelect: (color: string) => void
}

export function ColorPicker({ selectedColor, onColorSelect }: ColorPickerProps) {
  const colors = [
    "bg-yellow-100",
    "bg-green-100",
    "bg-blue-100",
    "bg-purple-100",
    "bg-pink-100",
    "bg-red-100",
    "bg-orange-100",
    "bg-teal-100",
  ]

  return (
    <div className="bg-white p-2 rounded-md shadow-lg border border-gray-200">
      <div className="grid grid-cols-4 gap-1">
        {colors.map((color) => (
          <div
            key={color}
            className={`h-6 w-6 rounded-full cursor-pointer hover:scale-110 transition-transform ${
              selectedColor === color ? "ring-2 ring-blue-500" : ""
            }`}
            style={{ backgroundColor: color.replace("bg-", "") }}
            onClick={() => onColorSelect(color)}
          />
        ))}
      </div>
    </div>
  )
}
