import { useRef, useState, useCallback, useEffect } from "react";

export function useAudioPlayback() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Initialize or retrieve the locked 24kHz AudioContext for playback
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch((err) => {
        console.error("Failed to resume playback AudioContext:", err);
      });
    }
    return audioContextRef.current;
  }, []);

  // Decode Base64 string into raw ArrayBuffer bytes
  const base64ToArrayBuffer = useCallback((base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }, []);

  // Queue and play an incoming base64 PCM chunk sequentially without gaps
  const playChunk = useCallback(
    (base64: string, chunkIndex: number) => {
      try {
        const audioCtx = getAudioContext();
        const arrayBuffer = base64ToArrayBuffer(base64);
        const int16Array = new Int16Array(arrayBuffer);
        const float32Array = new Float32Array(int16Array.length);

        // Convert Int16 signed bytes [-32768, 32767] back to Float32 [-1.0, 1.0] for the AudioContext
        for (let i = 0; i < int16Array.length; i++) {
          const sample = int16Array[i];
          float32Array[i] = sample / (sample < 0 ? 32768 : 32767);
        }

        // Create Web Audio Buffer: Mono channel, 24kHz sample rate
        const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
        audioBuffer.copyToChannel(float32Array, 0);

        // Set up the Buffer Source node
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);

        const currentTime = audioCtx.currentTime;
        let playTime = nextPlayTimeRef.current;

        // If our scheduled timestamp is in the past, align it with a safe lookahead buffer
        if (playTime < currentTime) {
          playTime = currentTime + 0.05; // 50ms buffer to prevent start popping
        }

        source.start(playTime);
        nextPlayTimeRef.current = playTime + audioBuffer.duration;

        // Keep track of active nodes for barge-in interruption support
        activeSourcesRef.current.push(source);
        setIsPlaying(true);

        source.onended = () => {
          activeSourcesRef.current = activeSourcesRef.current.filter((node) => node !== source);
          if (activeSourcesRef.current.length === 0) {
            setIsPlaying(false);
          }
        };
      } catch (err) {
        console.error(`Error playing PCM chunk #${chunkIndex}:`, err);
      }
    },
    [getAudioContext, base64ToArrayBuffer]
  );

  // Stop all playback immediately (critical for barging in / user interruption)
  const stopPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (err) {
        // Ignore if the node was already garbage collected or stopped
      }
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
    setIsPlaying(false);
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch((err) => {
          console.error("Error closing playback AudioContext:", err);
        });
        audioContextRef.current = null;
      }
    };
  }, [stopPlayback]);

  return { playChunk, stopPlayback, isPlaying };
}
