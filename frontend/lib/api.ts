// API client for Bambu Assistant backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  job_id?: string;
}

export interface Job {
  id: string;
  status: 'pending' | 'generating' | 'ready' | 'printing' | 'complete' | 'failed' | 'cancelled';
  prompt: string;
  model_url?: string;
  thumbnail_url?: string;
  progress?: number;
  created_at: string;
  updated_at: string;
  dimensions?: {
    width: number;
    depth: number;
    height: number;
  };
  estimated_time?: number;
  error?: string;
}

export interface PrinterStatus {
  state: 'idle' | 'running' | 'paused' | 'finished' | 'failed' | 'offline';
  progress_percent: number;
  remaining_time_seconds: number;
  current_layer: number;
  total_layers: number;
  job_name: string;
  nozzle_temp: number;
  nozzle_target: number;
  bed_temp: number;
  bed_target: number;
  chamber_temp: number;
  light_on: boolean;
}

export interface ChatResponse {
  message: Message;
  job?: Job;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Chat endpoints
  async sendMessage(content: string, conversationId?: string): Promise<ChatResponse> {
    return this.fetch<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ content, conversation_id: conversationId }),
    });
  }

  async getConversation(conversationId: string): Promise<Message[]> {
    return this.fetch<Message[]>(`/chat/${conversationId}`);
  }

  // Job endpoints
  async getJob(jobId: string): Promise<Job> {
    return this.fetch<Job>(`/jobs/${jobId}`);
  }

  async listJobs(limit = 20): Promise<Job[]> {
    return this.fetch<Job[]>(`/jobs?limit=${limit}`);
  }

  async confirmPrint(jobId: string): Promise<Job> {
    return this.fetch<Job>(`/jobs/${jobId}/confirm`, {
      method: 'POST',
    });
  }

  async cancelJob(jobId: string): Promise<Job> {
    return this.fetch<Job>(`/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  }

  // Printer endpoints
  async getPrinterStatus(): Promise<PrinterStatus> {
    return this.fetch<PrinterStatus>('/printer/status');
  }

  async pausePrint(): Promise<void> {
    return this.fetch('/printer/pause', { method: 'POST' });
  }

  async resumePrint(): Promise<void> {
    return this.fetch('/printer/resume', { method: 'POST' });
  }

  async stopPrint(): Promise<void> {
    return this.fetch('/printer/stop', { method: 'POST' });
  }

  async toggleLight(on: boolean): Promise<void> {
    return this.fetch('/printer/light', {
      method: 'POST',
      body: JSON.stringify({ on }),
    });
  }

  // Model endpoints
  getModelUrl(jobId: string): string {
    return `${this.baseUrl}/models/${jobId}/model.glb`;
  }

  getThumbnailUrl(jobId: string): string {
    return `${this.baseUrl}/models/${jobId}/thumbnail.png`;
  }
}

export const api = new ApiClient(API_URL);
