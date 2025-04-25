/**
 * Analyzes transcription content to determine if it contains meaningful information
 * worth converting into a note.
 *
 * @param text The transcription text to analyze
 * @returns An object with a score and evaluation result
 */
export function analyzeContentQuality(text: string): {
  score: number
  isNoteworthy: boolean
  reason: string
} {
  if (!text || text.trim().length === 0) {
    return { score: 0, isNoteworthy: false, reason: "Empty content" }
  }

  const normalizedText = text.toLowerCase().trim()
  const wordCount = normalizedText.split(/\s+/).length

  // Initialize score
  let score = 0
  let reason = ""

  // 1. Check for minimum content length - significantly reduced
  if (wordCount < 3) {
    return { score: 0.1, isNoteworthy: false, reason: "Content too short" }
  }

  // Give a base score to all content that meets minimum length
  score += 0.15

  // 2. Check for information indicators
  const infoIndicators = [
    // Numbers and statistics
    { pattern: /\d+(\.\d+)?(\s*%)?/, weight: 0.12, name: "numbers" },

    // Proper nouns (simplified check for capitalized words not at sentence start)
    { pattern: /(?<!\.\s+)[A-Z][a-z]+/, weight: 0.08, name: "proper nouns" },

    // Key phrases indicating facts
    {
      pattern: /(?:is|are|was|were|has|have|had|can|could|should|would|will)\s+/,
      weight: 0.05,
      name: "factual statements",
    },

    // Technical or domain-specific terms
    {
      pattern:
        /(?:algorithm|function|process|method|technique|system|framework|api|interface|component|module|database|server|client|user|data|information|analysis|research|study|report|result|finding)s?/,
      weight: 0.08,
      name: "technical terms",
    },

    // Comparative language
    {
      pattern: /(?:more|less|better|worse|higher|lower|increase|decrease|improve|reduce|enhance|diminish)/,
      weight: 0.05,
      name: "comparisons",
    },

    // Specific time references
    {
      pattern: /(?:today|yesterday|tomorrow|last\s+\w+|next\s+\w+|in\s+\d+\s+\w+|during|after|before|while|when)/,
      weight: 0.05,
      name: "time references",
    },

    // Causal relationships
    {
      pattern:
        /(?:because|since|as|therefore|thus|hence|consequently|due to|results in|causes|affects|influences|impacts|leads to|follows from)/,
      weight: 0.08,
      name: "causal relationships",
    },

    // Lists or enumerations
    {
      pattern:
        /(?:first|second|third|fourth|fifth|finally|lastly|next|then|also|additionally|furthermore|moreover|in addition)/,
      weight: 0.05,
      name: "structured information",
    },

    // Definitions
    {
      pattern: /(?:means|refers to|is defined as|is a|are|represents|signifies|denotes|indicates|suggests)/,
      weight: 0.05,
      name: "definitions",
    },

    // Names and entities
    {
      pattern:
        /(?:john|jane|bob|alice|david|sarah|michael|james|robert|mary|william|elizabeth|richard|joseph|thomas|charles|susan|jessica|daniel|jennifer)/,
      weight: 0.05,
      name: "names",
    },

    // Common meeting/work terms
    {
      pattern:
        /(?:meeting|call|conference|discussion|presentation|project|deadline|task|goal|objective|plan|strategy|team|group|department|manager|client|customer|email|report|document|file|folder)/,
      weight: 0.05,
      name: "work terms",
    },

    // Locations
    {
      pattern:
        /(?:office|room|building|street|avenue|road|boulevard|city|town|state|country|region|area|location|place|site)/,
      weight: 0.05,
      name: "locations",
    },

    // Action verbs
    {
      pattern:
        /(?:create|build|develop|implement|design|make|start|begin|finish|complete|deliver|send|receive|update|change|modify|improve|fix|solve)/,
      weight: 0.05,
      name: "action verbs",
    },
  ]

  // Track which indicators were found
  const foundIndicators: string[] = []

  // Check for each indicator
  infoIndicators.forEach((indicator) => {
    if (indicator.pattern.test(normalizedText)) {
      score += indicator.weight
      foundIndicators.push(indicator.name)
    }
  })

  // 3. Check for filler phrases that reduce information density - reduced penalty
  const fillerPhrases = [
    /(?:um|uh|like|you know|i mean|sort of|kind of|basically|actually|literally|honestly|to be honest|i guess|i think|i believe|in my opinion)/g,
    /(?:so|well|right|okay|now|anyway|anyhow|whatever|as i was saying|where was i)/g,
  ]

  let fillerCount = 0
  fillerPhrases.forEach((phrase) => {
    const matches = normalizedText.match(phrase)
    if (matches) {
      fillerCount += matches.length
    }
  })

  // Reduce score based on filler density, but with a much smaller penalty
  const fillerDensity = fillerCount / wordCount
  score -= fillerDensity * 0.1 // Significantly reduced from 0.2

  // 4. Adjust score based on content length (favor moderate length)
  if (wordCount > 5 && wordCount < 100) {
    score += 0.05 // Bonus for ideal length
  } else if (wordCount > 150) {
    score -= 0.05 // Penalty for excessive length
  }

  // 5. Check for question patterns - minimal penalty
  if (
    /\?|(?:who|what|when|where|why|how)\s+(?:is|are|was|were|will|would|could|should|do|does|did|can|could)\s+(?:the|a|an|it|they|we|you|i)\s+/i.test(
      normalizedText,
    )
  ) {
    score -= 0.02 // Minimal penalty
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(1, score))

  // Determine if content is noteworthy based on score threshold
  // Significantly lower the threshold from 0.25 to 0.15
  const isNoteworthy = score >= 0.15

  // Generate reason
  if (isNoteworthy) {
    reason = `Content contains ${foundIndicators.join(", ")}`
  } else {
    reason =
      foundIndicators.length > 0
        ? `Insufficient information density (score: ${score.toFixed(2)})`
        : `No significant information detected`
  }

  return {
    score,
    isNoteworthy,
    reason,
  }
}
