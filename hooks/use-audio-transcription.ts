'use client';

import { useState, useCallback, useRef } from 'react';
import { experimental_transcribe as transcribe, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { analyzeContentQuality } from '@/lib/content-analysis';

// Create OpenAI client with API key
const openai = createOpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  compatibility: 'strict',
});

export function useAudioTranscription() {
  const [transcription, setTranscription] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [contentQuality, setContentQuality] = useState<{
    score: number;
    reason: string;
  } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const accumulatedTranscriptionRef = useRef<string>('');
  const silenceStartTimeRef = useRef<number | null>(null);
  const lastProcessingTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioLevelHistoryRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const processedSummariesRef = useRef<Set<string>>(new Set());
  const filteredContentCountRef = useRef<number>(0);
  const transcriptionErrorCountRef = useRef<number>(0);

  // Configuration parameters - more permissive settings
  const pauseDetectionThreshold = 400; // Reduced from 500ms to 400ms for even more responsive detection
  const minSilenceLevel = 0.02; // Reduced threshold for detecting silence
  const minContentLength = 3; // Reduced from 5 to 3 words to process even shorter phrases
  const maxContentLength = 150; // Maximum number of words before forcing processing
  const minTimeBetweenNotes = 800; // Reduced from 1000ms to 800ms for more frequent notes
  const audioLevelHistorySize = 20; // Keep track of the last 20 audio level samples
  const maxTranscriptionErrors = 3; // Maximum number of consecutive transcription errors before showing a fallback message

  // Generate a topical note from the transcribed text
  const generateTopicalNote = async (text: string): Promise<string> => {
    if (!text || text.trim() === '') {
      return '';
    }

    try {
      console.log('Generating topical note from:', text);

      // First, analyze content quality
      const analysis = analyzeContentQuality(text);
      setContentQuality(analysis);

      // Almost always consider content noteworthy unless it's truly empty or meaningless
      if (!analysis.isNoteworthy && analysis.score >= 0.1) {
        // If score is at least 0.1, consider it noteworthy anyway
        analysis.isNoteworthy = true;
        analysis.reason = 'Content may contain useful information';
      }

      // If content isn't noteworthy, skip note generation
      if (!analysis.isNoteworthy) {
        console.log(
          `Content filtered out: ${
            analysis.reason
          } (score: ${analysis.score.toFixed(2)})`
        );
        filteredContentCountRef.current += 1;
        return '';
      }

      // Prompt designed to extract information with very relaxed standards
      const { text: summaryText } = await generateText({
        model: openai('gpt-4o'),
        prompt: `You are a professional note-taker in a meeting. Convert this transcription into a concise, direct note.
  
Create a brief note (1-2 sentences) that captures the key information. Format it as a complete thought in simple, direct language.

IMPORTANT:
- Do NOT use phrases like "The speaker says" or "The discussion mentions"
- Write in a direct, concise style as if you're taking notes in real-time
- Capture the core idea or fact without attribution
- Only respond with "NO_NOTEWORTHY_CONTENT" if the transcription is completely meaningless (like only "um", "uh", or random sounds)
- Try to extract something useful from almost any input, even if it's just a fragment

Transcription: "${text}"`,
        temperature: 0.3, // Increased temperature for more flexibility
        maxTokens: 100, // Limit the length of the summary
      });

      // Check if the model determined there's no noteworthy content
      if (summaryText.includes('NO_NOTEWORTHY_CONTENT')) {
        console.log('AI determined content is not noteworthy');
        filteredContentCountRef.current += 1;
        return '';
      }

      // Check if we've already generated a very similar summary - with reduced similarity threshold
      const isDuplicate = Array.from(processedSummariesRef.current).some(
        (existingSummary) => {
          // Simple string similarity check
          const similarity = calculateSimpleStringSimilarity(
            summaryText.trim(),
            existingSummary
          );
          return similarity > 0.85; // Reduced from typical 0.9 threshold
        }
      );

      if (isDuplicate) {
        console.log('Duplicate summary detected, skipping');
        return '';
      }

      console.log('Generated topical note:', summaryText);

      // Add to processed summaries
      processedSummariesRef.current.add(summaryText.trim());

      return summaryText;
    } catch (error) {
      console.error('Note generation error:', error);
      return ''; // Return empty string on error to prevent fallback notes
    }
  };

  // Simple string similarity function for duplicate detection
  const calculateSimpleStringSimilarity = (
    str1: string,
    str2: string
  ): number => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // If strings are identical
    if (s1 === s2) return 1.0;

    // If either string is empty
    if (s1.length === 0 || s2.length === 0) return 0.0;

    // Count matching words
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);

    let matchCount = 0;
    for (const word of words1) {
      if (words2.includes(word)) {
        matchCount++;
      }
    }

    // Calculate similarity as proportion of matching words
    return matchCount / Math.max(words1.length, words2.length);
  };

  // Process accumulated transcription and generate a note
  const processAccumulatedContent = async () => {
    const content = accumulatedTranscriptionRef.current.trim();

    // Only process if we have enough content
    if (content && content.split(' ').length >= minContentLength) {
      setIsProcessing(true);
      try {
        console.log('Processing accumulated content:', content);
        setTranscription(content);

        const topicalNote = await generateTopicalNote(content);

        // Only set summary if we got a non-empty result (not a duplicate or filtered)
        if (topicalNote) {
          setSummary(topicalNote);
          // Update last processing time
          lastProcessingTimeRef.current = Date.now();
        }

        // Reset accumulated content after processing
        accumulatedTranscriptionRef.current = '';
      } catch (error) {
        console.error('Processing error:', error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Check for pauses in speech using audio level history
  const checkForSpeechPause = () => {
    const now = Date.now();
    const timeSinceLastProcessing = now - lastProcessingTimeRef.current;

    // If we haven't processed in a while and have enough content, process it
    const wordCount = accumulatedTranscriptionRef.current.split(' ').length;
    if (
      wordCount >= maxContentLength &&
      timeSinceLastProcessing > minTimeBetweenNotes
    ) {
      console.log('Processing due to maximum content length reached');
      processAccumulatedContent();
      return;
    }

    // Need at least a few samples to detect a pause
    if (audioLevelHistoryRef.current.length < 5) return;

    // Get recent audio levels
    const recentLevels = audioLevelHistoryRef.current.slice(-5);

    // Check if all recent levels are below the silence threshold
    const isCurrentlySilent = recentLevels.every(
      (level) => level < minSilenceLevel
    );

    // Detect transition from speech to silence
    if (isCurrentlySilent) {
      if (silenceStartTimeRef.current === null) {
        silenceStartTimeRef.current = now;
      } else if (now - silenceStartTimeRef.current >= pauseDetectionThreshold) {
        // We've detected a pause (silence for pauseDetectionThreshold ms)
        if (
          wordCount >= minContentLength &&
          timeSinceLastProcessing > minTimeBetweenNotes
        ) {
          console.log('Processing due to speech pause detected');
          processAccumulatedContent();
        }
      }
    } else {
      // Reset silence detection if sound is detected
      silenceStartTimeRef.current = null;
    }
  };

  // Set up continuous audio level monitoring
  const setupAudioLevelMonitoring = (analyser: AnalyserNode) => {
    analyserRef.current = analyser;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Initialize audio level history
    audioLevelHistoryRef.current = Array(audioLevelHistorySize).fill(0);

    // Function to sample audio level
    const sampleAudioLevel = () => {
      if (!analyserRef.current || !mediaRecorderRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average audio level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length / 255; // Normalize to 0-1
      setAudioLevel(average); // Update state for visualization

      // Add to history, keeping only the most recent samples
      audioLevelHistoryRef.current.push(average);
      if (audioLevelHistoryRef.current.length > audioLevelHistorySize) {
        audioLevelHistoryRef.current.shift();
      }

      // Check for speech pauses
      checkForSpeechPause();

      // Schedule next sample using requestAnimationFrame for smoother monitoring
      animationFrameRef.current = requestAnimationFrame(sampleAudioLevel);
    };

    // Start sampling
    animationFrameRef.current = requestAnimationFrame(sampleAudioLevel);
  };

  // Get supported MIME type for recording
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/mpeg',
      '', // Empty string will use the browser's default
    ];

    for (const type of types) {
      if (!type || MediaRecorder.isTypeSupported(type)) {
        console.log(`Using MIME type: ${type || 'default'}`);
        return type;
      }
    }

    // If no supported type is found, return empty string to use default
    return '';
  };

  // Create and start a new MediaRecorder instance
  const createAndStartMediaRecorder = (stream: MediaStream) => {
    try {
      // Clean up any existing recorder
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        } catch (e) {
          console.error('Error stopping previous recorder:', e);
        }
        mediaRecorderRef.current = null;
      }

      // Get supported MIME type
      const mimeType = getSupportedMimeType();

      // Create recorder with options
      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }

      // Create new MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      mediaRecorder.onstop = async () => {
        await processAudioChunks();
      };

      // Start recording with shorter timeslices for more frequent data
      mediaRecorder.start(1000); // Get data every 1 second
      console.log('MediaRecorder started successfully');

      return true;
    } catch (error) {
      console.error('Error creating MediaRecorder:', error);
      return false;
    }
  };

  // Process audio chunks after recording stops
  const processAudioChunks = async () => {
    if (audioChunksRef.current.length > 0) {
      setIsProcessing(true);
      try {
        // Determine the MIME type based on the first chunk
        const mimeType = audioChunksRef.current[0].type || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log(
          `Audio blob size: ${audioBlob.size} bytes, MIME type: ${mimeType}`
        );

        if (audioBlob.size < 800) {
          // Reduced from 1000 to 800 bytes
          console.warn('Audio blob is too small, skipping transcription');
          setIsProcessing(false);

          // Restart recording if still active
          if (streamRef.current && mediaRecorderRef.current) {
            audioChunksRef.current = [];
            try {
              if (mediaRecorderRef.current) {
                mediaRecorderRef.current.start(1000);
              }
            } catch (e) {
              console.error('Error restarting recorder:', e);
              // If restart fails, create a new recorder
              createAndStartMediaRecorder(streamRef.current);
            }
          }
          return;
        }

        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Use a try-catch specifically for the transcription
        try {
          console.log('Starting transcription with Whisper...');

          // Add more detailed logging
          console.log(
            `Audio data: ${uint8Array.length} bytes, first few bytes:`,
            uint8Array.slice(0, 20).join(', ')
          );

          const result = await transcribe({
            model: openai.transcription('whisper-1'),
            audio: uint8Array,
            // Add language hint for better accuracy
            providerOptions: {
              openai: {
                language: 'en',
              },
            },
            // Add a timeout to prevent hanging
            abortSignal: AbortSignal.timeout(10000), // 10 second timeout
          });

          // Reset error count on successful transcription
          transcriptionErrorCountRef.current = 0;

          if (result && result.text) {
            console.log('Transcription successful:', result.text);

            // Accumulate transcriptions instead of immediately processing
            accumulatedTranscriptionRef.current += ' ' + result.text;
            console.log(
              'Accumulated content:',
              accumulatedTranscriptionRef.current
            );

            // Add a periodic check to process content even if no pause is detected
            // This ensures we don't wait too long between processing
            const now = Date.now();
            const timeSinceLastProcessing = now - lastProcessingTimeRef.current;
            if (
              timeSinceLastProcessing > 3000 &&
              accumulatedTranscriptionRef.current.trim().length > 0
            ) {
              // Reduced from 5000ms to 3000ms
              console.log('Processing due to time threshold');
              processAccumulatedContent();
            }
          } else {
            console.error('No transcription text returned', result);
            handleTranscriptionError(
              new Error('No transcription text returned')
            );
          }
        } catch (transcriptionError) {
          console.error('Transcription API error:', transcriptionError);
          handleTranscriptionError(transcriptionError as Error);
        }
      } catch (error) {
        console.error('Audio processing error:', error);
      } finally {
        setIsProcessing(false);

        // Restart recording if still active
        if (streamRef.current && mediaRecorderRef.current) {
          audioChunksRef.current = [];
          try {
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.start(1000);
            }
          } catch (e) {
            console.error('Error restarting recorder:', e);
            // If restart fails, create a new recorder
            createAndStartMediaRecorder(streamRef.current);
          }
        }
      }
    } else {
      console.warn('No audio chunks recorded');
      setIsProcessing(false);

      // Restart recording if still active
      if (streamRef.current && mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current) {
            mediaRecorderRef.current.start(1000);
          }
        } catch (e) {
          console.error('Error restarting recorder:', e);
          // If restart fails, create a new recorder
          createAndStartMediaRecorder(streamRef.current);
        }
      }
    }
  };

  // Handle transcription errors with fallback
  const handleTranscriptionError = (error: Error) => {
    transcriptionErrorCountRef.current += 1;

    // If we've had too many consecutive errors, add a fallback message
    if (transcriptionErrorCountRef.current >= maxTranscriptionErrors) {
      // Add a fallback message to the accumulated transcription
      const fallbackMessage = 'Speech detected but transcription unavailable.';

      // Only add if we don't already have this message
      if (!accumulatedTranscriptionRef.current.includes(fallbackMessage)) {
        accumulatedTranscriptionRef.current += ' ' + fallbackMessage;

        // Process this content to create a note
        processAccumulatedContent();
      }

      console.log(
        'Added fallback message due to repeated transcription errors'
      );
    }
  };

  // Start recording audio
  const startRecording = useCallback(async () => {
    try {
      // Reset state
      accumulatedTranscriptionRef.current = '';
      lastProcessingTimeRef.current = Date.now();
      silenceStartTimeRef.current = null;
      audioLevelHistoryRef.current = [];
      processedSummariesRef.current = new Set();
      filteredContentCountRef.current = 0;
      transcriptionErrorCountRef.current = 0;
      setContentQuality(null);
      setAudioLevel(0);

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Store stream reference
      streamRef.current = stream;

      // Create an audio context to monitor audio levels
      try {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        // Set up more frequent audio level monitoring
        setupAudioLevelMonitoring(analyser);
      } catch (audioContextError) {
        console.error('Error setting up audio context:', audioContextError);
        // Continue without audio level monitoring
      }

      // Create and start MediaRecorder
      const recorderStarted = createAndStartMediaRecorder(stream);
      if (!recorderStarted) {
        throw new Error('Failed to start MediaRecorder');
      }

      // Set up periodic processing (as a fallback, but less frequent)
      processingTimeoutRef.current = setInterval(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === 'recording'
        ) {
          console.log('Processing audio chunk (timed fallback)...');
          try {
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.stop();
            }
          } catch (e) {
            console.error('Error stopping recorder:', e);
          }
        }
      }, 3000); // Reduced from 5 seconds to 3 seconds for more frequent processing
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsProcessing(false);
      throw error; // Re-throw to allow the caller to handle it
    }
  }, []);

  // Stop recording audio and process any remaining content
  const stopRecording = useCallback(async () => {
    console.log('Stopping recording...');

    // Cancel any animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear the processing interval
    if (processingTimeoutRef.current) {
      clearInterval(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    // Stop MediaRecorder if it exists and is recording
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
      }
      mediaRecorderRef.current = null;
    }

    // Stop all audio tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.error('Error closing AudioContext:', e);
      }
      audioContextRef.current = null;
    }

    // Process any remaining accumulated content
    if (accumulatedTranscriptionRef.current.trim()) {
      await processAccumulatedContent();
    }

    // Reset audio level
    setAudioLevel(0);

    // Log statistics
    console.log(
      `Content filtering stats: ${filteredContentCountRef.current} segments filtered out`
    );
  }, []);

  return {
    startRecording,
    stopRecording,
    transcription,
    summary,
    isProcessing,
    audioLevel,
    contentQuality,
    filteredCount: filteredContentCountRef.current,
  };
}
