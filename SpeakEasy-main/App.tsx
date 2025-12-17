import React, { useRef, useEffect } from 'react';
import { useLiveSession } from './hooks/useLiveSession';
import { ConnectionState } from './types';
import Visualizer from './components/Visualizer';
import ChatBubble from './components/ChatBubble';
import { Mic, MicOff, Volume2, Info } from 'lucide-react';

const App: React.FC = () => {
  const { connectionState, connect, disconnect, volume, messages } = useLiveSession();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;
  const isError = connectionState === ConnectionState.ERROR;

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleToggle = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-slate-50 relative shadow-xl overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
             <Volume2 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">SpeakEasy Friend</h1>
            <p className="text-xs text-slate-500 font-medium">Your Daily Practice Partner</p>
          </div>
        </div>
        <div className="relative group">
          <Info size={20} className="text-slate-400 cursor-help" />
          <div className="absolute right-0 mt-2 w-48 bg-slate-800 text-white text-xs p-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            Speak clearly. I am here to help you practice, not judge you!
          </div>
        </div>
      </header>

      {/* Main Chat Area - Flexible Height */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-slate-50">
        {messages.length === 0 && !isConnected && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
             <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                <Mic size={40} className="text-indigo-300" />
             </div>
             <h2 className="text-lg font-semibold text-slate-600 mb-2">Ready to practice?</h2>
             <p className="max-w-xs text-sm">Tap the microphone button below to start talking with your new English friend.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Visualizer & Controls Area */}
      <div className="bg-white border-t border-slate-100 p-6 flex flex-col items-center justify-center relative">
        
        {/* Visualizer Container */}
        <div className="absolute top-[-60px] left-1/2 transform -translate-x-1/2 w-32 h-32 pointer-events-none opacity-90">
             <Visualizer isActive={isConnected} volume={volume} />
        </div>

        {/* Status Text */}
        <div className="mb-6 h-6">
          {isConnecting && <span className="text-indigo-500 font-medium animate-pulse">Connecting to friend...</span>}
          {isConnected && <span className="text-green-500 font-medium">Listening...</span>}
          {isError && <span className="text-red-500 font-medium">Connection failed. Try again.</span>}
        </div>

        {/* Main Action Button */}
        <button
          onClick={handleToggle}
          disabled={isConnecting}
          className={`
            relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300
            ${isConnected 
              ? 'bg-red-50 hover:bg-red-100 text-red-500 border-2 border-red-100' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}
            ${isConnecting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
          `}
          aria-label={isConnected ? "Stop conversation" : "Start conversation"}
        >
          {isConnected ? <MicOff size={32} /> : <Mic size={32} />}
        </button>

        <p className="mt-4 text-sm text-slate-400 font-medium">
          {isConnected ? "Tap to end session" : "Tap to start"}
        </p>
      </div>
    </div>
  );
};

export default App;