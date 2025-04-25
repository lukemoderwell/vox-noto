/**
 * Calculates the similarity between two strings using Levenshtein distance
 * @param str1 First string to compare
 * @param str2 Second string to compare
 * @returns A value between 0 and 1, where 1 means identical
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0
  if (str1.length === 0 || str2.length === 0) return 0.0

  // Normalize strings for comparison
  const a = str1.toLowerCase().trim()
  const b = str2.toLowerCase().trim()

  // Calculate Levenshtein distance
  const matrix = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(null))

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      )
    }
  }

  // Calculate similarity as 1 - normalized distance
  const maxLength = Math.max(a.length, b.length)
  if (maxLength === 0) return 1.0

  return 1.0 - matrix[a.length][b.length] / maxLength
}

/**
 * Checks if a text is similar to any text in an array
 * @param text The text to check
 * @param existingTexts Array of existing texts to compare against
 * @param threshold Similarity threshold (0-1)
 * @returns true if the text is similar to any existing text
 */
export function isSimilarToExisting(text: string, existingTexts: string[], threshold = 0.8): boolean {
  if (!text || text.trim().length === 0) return false

  return existingTexts.some((existingText) => {
    const similarity = calculateStringSimilarity(text, existingText)
    return similarity >= threshold
  })
}
