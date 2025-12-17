export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isPartial?: boolean;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
}
