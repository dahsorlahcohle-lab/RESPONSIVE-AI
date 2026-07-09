import { useState, useEffect, useRef } from "react";

export interface TranscriptMessage {
  speaker: "User" | "AI";
  message: string;
  timestamp: string;
}

interface UseCallTranscriptParams {
  isActive: boolean;
  currentAiText: string;
  callSessionId: string | null;
  authToken: string;
  onSaveCompleted?: (messages: TranscriptMessage[]) => void;
}

/**
 * Silently records a call as text in the background -- the user's side via the
 * browser's speech recognition, and the AI's side from its own streamed text --
 * then saves the full transcript to the backend (tied to the call's contact)
 * the moment the call ends.
 *
 * This is intentionally headless: there is no live on-screen transcript anymore.
 * Recording and saving still happen exactly as before, just without a UI.
 */
export function useCallTranscript({
  isActive,
  currentAiText,
  callSessionId,
  authToken,
  onSaveCompleted
}: UseCallTranscriptParams) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const recognitionRef = useRef<any>(null);

  // Set up Web Speech API Speech Recognition for User voice transcription
  useEffect(() => {
    if (!isActive) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser. User transcriptions will not be recorded.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        const lastResultIndex = event.resultIndex;
        const resultText = event.results[lastResultIndex]?.[0]?.transcript?.trim();

        if (resultText) {
          const userMsg: TranscriptMessage = {
            speaker: "User",
            message: resultText,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, userMsg]);
        }
      };

      rec.onerror = (err: any) => {
        console.error("Background call transcription error:", err);
      };

      rec.onend = () => {
        // Automatically restart if call is still active
        if (isActive && recognitionRef.current) {
          try { rec.start(); } catch (e) {}
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error("Failed to start background call transcription:", e);
    }

    // Reset messages for the new call session
    setMessages([]);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, [isActive]);

  // Append AI message when it completes speaking
  const prevAiTextRef = useRef("");
  useEffect(() => {
    if (!isActive) {
      prevAiTextRef.current = "";
      return;
    }

    // If currentAiText becomes empty and we had text previously, the model turn completed
    if (!currentAiText && prevAiTextRef.current) {
      const aiMsg: TranscriptMessage = {
        speaker: "AI",
        message: prevAiTextRef.current,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);
      prevAiTextRef.current = "";
    } else if (currentAiText) {
      prevAiTextRef.current = currentAiText;
    }
  }, [currentAiText, isActive]);

  // Automatically save to the server (tied to this call's contact) when the call ends
  useEffect(() => {
    if (!isActive && messages.length > 0 && callSessionId) {
      const saveTranscript = async () => {
        try {
          await fetch(`/api/calls/${callSessionId}/transcript`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ messages })
          });
          if (onSaveCompleted) {
            onSaveCompleted(messages);
          }
        } catch (err) {
          console.error("Failed to automatically save call transcript:", err);
        }
      };
      saveTranscript();
    }
  }, [isActive, messages, callSessionId, authToken, onSaveCompleted]);
}
