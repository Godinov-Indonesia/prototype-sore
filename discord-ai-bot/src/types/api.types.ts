// Payloads matching NestJS DTOs

export interface CreateSessionPayload {
  title: string;
}

export interface CreateSessionResponse {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessagePayload {
  content: string;
}

export interface SendMessageResponse {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface QueryRagPayload {
  query: string;
  topK?: number;
}

export interface QueryRagReference {
  documentId?: string;
  chunkIndex?: number;
  score?: number;
  textSnippet?: string;
}

export interface QueryRagResponse {
  answer: string;
  references: QueryRagReference[];
}

export interface EmployeeResponse {
  id: string;
  idKaryawan: string;
  namaLengkap: string;
  jenisKelamin?: string | null;
  tanggalLahir?: string | null;
  jabatan: string;
  departemen: string;
  level?: string | null;
  email: string;
  nomorTelepon?: string | null;
  tanggalBergabung?: string | null;
  lokasiKerja?: string | null;
  status: string;
}

export interface TaskResponse {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  status: string;
  employeeId: string;
  employee: EmployeeResponse;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderResponse {
  id: string;
  taskTitle: string;
  email: string;
  remindAt: string;
  sent: boolean;
  type: string;
  createdAt: string;
}
