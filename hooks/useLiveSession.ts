import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState, ChatMessage } from '../types';
import {
  createBlob,
  decodeAudioData,
  decode,
  AUDIO_SAMPLE_RATE_INPUT,
  AUDIO_SAMPLE_RATE_OUTPUT
} from '../utils/audioUtils';

// System instruction defining the persona
const SYSTEM_INSTRUCTION = `
You are a friendly English-speaking partner for a beginner learner from India.

STRICT LANGUAGE RULES:
1. Speak ONLY in English. Never switch to Hindi or any other language.
2. The user has an Indian accent. Always interpret their speech as English. 
3. If the input is unclear or sounds like another language, assume it is English first. If still unclear, gently ask: "Could you say that again in English?"

TARGET USER: Adult beginner, native Indian speaker, learning for daily life. Low confidence.
YOUR ROLE: Patient friend, NOT a teacher. Speak in very simple English. Use short sentences. Speak slowly/clearly.
CONVERSATION STYLE: Ask ONE question at a time. Use common daily words. Never correct harshly.
ERROR HANDLING: If user makes a mistake, repeat correctly and say: "That is good. You can also say it like this..." then ask them to try again. Never say "wrong".
FLOW: Greetings -> Family/Food/Shopping/Weather -> Follow-up.
PRONUNCIATION: Break long sentences down.
TONE: Warm, kind, encouraging.
START: "Hello 😊 I am your English speaking friend. Let us practice English together. How are you today?"
`;

export const useLiveSession = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [volume, setVolume] = useState<number>(0); // For visualizer

  // Refs for audio handling to avoid re-renders
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Shared cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up session resources');

    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    // Disconnect and close audio context stuff
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Stop active audio sources
    activeSourcesRef.current.forEach(src => {
      try { src.stop(); } catch (e) { }
    });
    activeSourcesRef.current.clear();

    sessionPromiseRef.current = null;
    setVolume(0);
  }, []);

  const connect = useCallback(async () => {
    try {
      // Ensure clean state before connecting
      cleanup();

      setConnectionState(ConnectionState.CONNECTING);

      // Initialize Audio Contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_SAMPLE_RATE_INPUT
      });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_SAMPLE_RATE_OUTPUT
      });

      outputNodeRef.current = outputAudioContextRef.current.createGain();
      outputNodeRef.current.connect(outputAudioContextRef.current.destination);

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Create session
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
        },
        callbacks: {
          onopen: () => {
            console.log('Session connected');
            setConnectionState(ConnectionState.CONNECTED);

            // Add initial greeting message locally
            setMessages([{
              id: 'init',
              role: 'assistant',
              text: "Hello 😊\nI am your English speaking friend.\nLet us practice English together.\nHow are you today?"
            }]);

            // Setup Input Processing
            if (!inputAudioContextRef.current || !streamRef.current) return;

            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            inputSourceRef.current = source;

            // Using ScriptProcessor for raw PCM access
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              // CRITICAL: Check if we are still connected before processing
              if (!sessionPromiseRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);

              // Calculate volume for visualizer
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(Math.min(rms * 5, 1));

              const pcmBlob = createBlob(inputData);

              // Send data only if session is valid
              sessionPromiseRef.current?.then((session) => {
                try {
                  session.sendRealtimeInput({ media: pcmBlob });
                } catch (e) {
                  console.warn("Failed to send audio input (session might be closed):", e);
                }
              }).catch(err => {
                // This catch handles rejection if sessionPromiseRef was nullified or rejected
                console.warn("Session promise issue during input:", err);
              });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

              try {
                const audioBuffer = await decodeAudioData(
                  decode(base64Audio),
                  ctx,
                  AUDIO_SAMPLE_RATE_OUTPUT,
                  1
                );

                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNodeRef.current);
                source.addEventListener('ended', () => {
                  activeSourcesRef.current.delete(source);
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                activeSourcesRef.current.add(source);
              } catch (e) {
                console.error("Audio decoding error:", e);
              }
            }

            // Handle Interruptions
            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(src => {
                try { src.stop(); } catch (e) { }
              });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log('Session closed');
            setConnectionState(ConnectionState.DISCONNECTED);
            cleanup();
          },
          onerror: (err) => {
            console.error('Session error', err);
            setConnectionState(ConnectionState.ERROR);
            cleanup();
          }
        }
      });

      // Catch initial connection errors
      sessionPromiseRef.current.catch((err) => {
        console.error("Connection promise rejected:", err);
        setConnectionState(ConnectionState.ERROR);
        cleanup();
      });

    } catch (error) {
      console.error("Failed to connect", error);
      setConnectionState(ConnectionState.ERROR);
      cleanup();
    }
  }, [cleanup]);

  const disconnect = useCallback(async () => {
    if (sessionPromiseRef.current) {
      // Wait for promise to resolve/reject before trying to close
      try {
        const session = await sessionPromiseRef.current;
        (session as any).close();
      } catch (e) {
        console.warn("Could not close session explicitly", e);
      }
    }

    // Run cleanup
    cleanup();
    setConnectionState(ConnectionState.DISCONNECTED);
  }, [cleanup]);

  return {
    connectionState,
    connect,
    disconnect,
    volume,
    messages
  };
};