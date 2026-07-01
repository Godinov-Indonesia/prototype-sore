import { 
  CreateSessionResponse, 
  TaskResponse, 
  ReminderResponse, 
  EmployeeResponse, 
  QueryRagResponse 
} from '../types/api.types';

export class ApiService {
  private static getBaseUrl(): string {
    const url = process.env.API_BASE_URL || 'http://localhost:3000/api';
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  private static async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData && errData.message) {
            errorMessage = Array.isArray(errData.message) 
              ? errData.message.join(', ') 
              : errData.message;
          }
        } catch {
          // Ignore JSON parse errors for non-JSON error responses
        }
        throw new Error(errorMessage);
      }

      // Handle empty response/204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json() as T;
    } catch (error: any) {
      console.error(`Request to ${url} failed:`, error.message);
      throw error;
    }
  }

  public static async createSession(title: string): Promise<CreateSessionResponse> {
    return this.request<CreateSessionResponse>('/chats', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  public static async getTasks(): Promise<TaskResponse[]> {
    return this.request<TaskResponse[]>('/agent/tasks', {
      method: 'GET',
    });
  }

  public static async getReminders(): Promise<ReminderResponse[]> {
    return this.request<ReminderResponse[]>('/agent/reminders', {
      method: 'GET',
    });
  }

  public static async getEmployees(): Promise<EmployeeResponse[]> {
    return this.request<EmployeeResponse[]>('/agent/employees', {
      method: 'GET',
    });
  }

  public static async queryRag(query: string): Promise<QueryRagResponse> {
    return this.request<QueryRagResponse>('/rag/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  public static async runAgent(prompt: string, fileBuffer?: Buffer, fileName?: string): Promise<any> {
    const url = `${this.getBaseUrl()}/agent/run`;
    const formData = new FormData();
    formData.append('prompt', prompt);
    if (fileBuffer && fileName) {
      const blob = new Blob([fileBuffer as any]);
      formData.append('file', blob, fileName);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error(`POST /agent/run failed:`, error.message);
      throw error;
    }
  }

  public static async uploadRagDocument(fileBuffer: Buffer, fileName: string): Promise<any> {
    const url = `${this.getBaseUrl()}/rag/upload`;
    const formData = new FormData();
    const blob = new Blob([fileBuffer as any]);
    formData.append('file', blob, fileName);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error(`POST /rag/upload failed:`, error.message);
      throw error;
    }
  }

  public static async getRagDocuments(): Promise<any[]> {
    return this.request<any[]>('/rag/documents');
  }
}
