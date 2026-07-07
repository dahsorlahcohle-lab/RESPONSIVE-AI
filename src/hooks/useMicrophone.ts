import { useState, useRef, useCallback } from "react";

interface UseMicrophoneProps {
  onAudioChunk: (base64: string) => void;
  onStart?: () => void;
  onStop?: () => void;
}

export function useMicrophone({ onAudioChunk, onStart, onStop }: UseMicrophoneProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Use refs to stabilize callbacks and prevent recreate loop
  const onAudioChunkRef = useRef(onAudioChunk);
  const onStartRef = useRef(onStart);
  const onStopRef = useRef(onStop);

  onAudioChunkRef.current = onAudioChunk;
  onStartRef.current = onStart;
  onStopRef.current = onStop;

  const start = useCallback(async () => {
    setError(null);
    try {
      // 1. Request microphone access with echo cancellation and high-quality voice preprocessing
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // 2. Create the AudioContext locked at 16kHz sample rate
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // 3. Connect microphone to source node
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // 4. Create ScriptProcessorNode with bufferSize of 4096 (highly stable block size)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // 5. Connect the nodes
      source.connect(processor);
      processor.connect(audioContext.destination);

      // Helper to convert ArrayBuffer to base64
      const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };

      // 6. Capture raw PCM samples
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0); // Float32 channel samples

        // Convert Float32Array samples [-1.0, 1.0] to 16-bit signed PCM (Int16Array)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }

        // Convert the raw Int16 PCM bytes to Base64 and push them
        const base64 = arrayBufferToBase64(pcmData.buffer);
        onAudioChunkRef.current(base64);
      };

      setIsRecording(true);
      if (onStartRef.current) onStartRef.current();
    } catch (err: any) {
      console.error("Microphone access failed:", err);
      let errMsg = "Could not access microphone.";
      if (err.name === "NotAllowedError") {
        errMsg = "Microphone permission denied by the browser.";
      } else if (err.name === "NotFoundError") {
        errMsg = "No audio input device (microphone) found.";
      } else {
        errMsg = err.message || errMsg;
      }
      setError(errMsg);
      setIsRecording(false);
    }
  }, []);

  const stop = useCallback(() => {
    // Disconnect and cleanup processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    // Disconnect stream source
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Stop all microphone tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close().catch((err) => {
        console.error("Error closing microphone AudioContext:", err);
      });
      audioContextRef.current = null;
    }

    setIsRecording(false);
    if (onStopRef.current) onStopRef.current();
  }, []);

  return { start, stop, isRecording, error };
}
