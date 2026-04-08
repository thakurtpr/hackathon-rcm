import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { Question } from '@/store/assessmentStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8001';

// Primary API client for Go backend
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// AI service client for Python FastAPI
export const aiClient = axios.create({
  baseURL: AI_URL,
  timeout: 60000,
});

// Request interceptor: inject JWT from Zustand auth store
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: 401 → try refresh token, else logout
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const state = useAuthStore.getState();
        const refreshToken =
          state.refreshToken ||
          (typeof window !== 'undefined' ? sessionStorage.getItem('refresh_token') : null);
        if (refreshToken) {
          const res = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });
          const { access_token, refresh_token: newRefresh } = res.data as { access_token: string; refresh_token?: string };
          const currentUser = state.user;
          state.login(
            access_token,
            currentUser || { id: state.userId || '', name: '' },
            undefined,
            undefined,
            newRefresh,
          );
          if (newRefresh && typeof window !== 'undefined') {
            sessionStorage.setItem('refresh_token', newRefresh);
          }
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(original);
        }
      } catch {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function registerUser(data: {
  full_name: string;
  mobile: string;
  email: string;
  dob: string;
  password: string;
  intent: string;
}) {
  const res = await apiClient.post('/auth/register', data);
  return res.data as { user_id: string; otp_token: string; expires_in: number };
}

export async function verifyOTP(data: { otp_token: string; otp_code: string }) {
  const res = await apiClient.post('/auth/verify-otp', data);
  const { access_token, refresh_token, user_id, intent } = res.data as {
    access_token: string;
    refresh_token?: string;
    user_id: string;
    intent?: string;
  };
  if (refresh_token) {
    if (typeof window !== 'undefined') sessionStorage.setItem('refresh_token', refresh_token);
    useAuthStore.getState().setRefreshToken(refresh_token);
  }
  return { access_token, refresh_token, user_id, intent };
}

export async function loginUser(data: { email: string; password: string }) {
  const res = await apiClient.post('/auth/login', data);
  const { access_token, refresh_token, user_id, kyc_status, intent } = res.data as {
    access_token: string;
    refresh_token?: string;
    user_id: string;
    kyc_status?: string;
    intent?: string;
  };
  if (refresh_token) {
    if (typeof window !== 'undefined') sessionStorage.setItem('refresh_token', refresh_token);
    useAuthStore.getState().setRefreshToken(refresh_token);
  }
  return { access_token, user_id, kyc_status, intent };
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function updateProfile(userId: string, data: Record<string, unknown>) {
  const res = await apiClient.put(`/users/${userId}/profile`, data);
  return res.data;
}

export async function getProfile(userId: string) {
  const res = await apiClient.get(`/users/${userId}/profile`);
  return res.data;
}

// ─── Documents ───────────────────────────────────────────────────────────────

export async function uploadDocument(docType: string, file: File, userId?: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('doc_type', docType);
  if (userId) form.append('user_id', userId);
  const res = await apiClient.post('/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as { doc_id: string; minio_path: string; status: string };
}

export async function getDocumentStatus(docId: string) {
  const res = await apiClient.get(`/documents/${docId}/status`);
  return res.data;
}

export interface DocumentsStatusResponse {
  documents: Record<string, string>;
  face_match_result: 'pending' | 'verified' | 'manual_review' | 'failed';
  face_match_score: number | null;
}

export async function getUserDocumentsStatus(userId: string): Promise<DocumentsStatusResponse> {
  try {
    const res = await apiClient.get(`/documents/user/${userId}/status`);
    const raw = res.data as Record<string, unknown>;
    // Separate face_match fields from doc-type status fields
    const face_match_result = (raw['face_match_result'] as DocumentsStatusResponse['face_match_result']) ?? 'pending';
    const face_match_score = (raw['face_match_score'] as number | null) ?? null;
    const documents: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k !== 'face_match_result' && k !== 'face_match_score') {
        documents[k] = v as string;
      }
    }
    return { documents, face_match_result, face_match_score };
  } catch {
    return { documents: {}, face_match_result: 'pending', face_match_score: null };
  }
}

export interface OcrField {
  [key: string]: string | number | null;
}

export interface OcrResult {
  doc_type: string;
  fields: OcrField;
  doc_trust_score: number;
  doc_authentic: boolean;
}

/** Fetch OCR-extracted fields from Redis (stored after Kafka doc.uploaded pipeline runs) */
export async function getOcrResult(userId: string, docType: string): Promise<OcrResult | null> {
  try {
    const res = await aiClient.get(`/ocr/result/${userId}/${docType}`);
    return res.data as OcrResult;
  } catch {
    return null; // 404 = not yet available
  }
}


// ─── Applications ─────────────────────────────────────────────────────────────

/**
 * Compute a hex SHA-256 of a string using the Web Crypto API.
 * Falls back to a djb2-style hash when SubtleCrypto is unavailable.
 */
async function sha256Hex(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for environments without SubtleCrypto (e.g. SSR)
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export async function createApplication(data: { user_id: string; type?: string; loan_amount?: number }) {
  // Idempotency key: sha256(userId:YYYY-MM-DD) — one key per user per day
  const today = new Date().toISOString().slice(0, 10);
  const idempotencyKey = await sha256Hex(`${data.user_id}:${today}`);

  const res = await apiClient.post('/applications', data, {
    headers: { 'X-Idempotency-Key': idempotencyKey },
  });
  return res.data as { app_id: string; status: string };
}

export async function getApplication(appId: string) {
  const res = await apiClient.get(`/applications/${appId}`);
  return res.data;
}

export async function getApplicationStatus(appId: string | null) {
  if (!appId) return { status: 'unknown', pipeline_stages: {} };
  try {
    const res = await apiClient.get(`/applications/${appId}/status`);
    return res.data;
  } catch {
    return { status: 'unknown', pipeline_stages: {} };
  }
}

export async function listUserApplications(userId: string) {
  const res = await apiClient.get(`/applications/user/${userId}`);
  return res.data;
}

// ─── Eligibility ──────────────────────────────────────────────────────────────

export async function getEligibilityScore(appId: string) {
  try {
    const res = await apiClient.get(`/eligibility/${appId}`);
    return res.data;
  } catch {
    return { composite: 0, band: 'pending' };
  }
}

export async function computeEligibility(data: Record<string, unknown>) {
  const res = await apiClient.post('/eligibility/compute', data);
  return res.data;
}

// ─── Behavioral ───────────────────────────────────────────────────────────────

export const getBehavioralQuestions = async (
  appId?: string,
  userId?: string,
  forceRefresh = false,
): Promise<Question[]> => {
  const id =
    appId ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('app_id') : null) ||
    '';
  const uid =
    userId ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('user_id') : null) ||
    '';

  const params = new URLSearchParams({ app_id: id });
  if (uid) params.set('user_id', uid);
  if (forceRefresh) params.set('force_refresh', 'true');

  console.log('[getBehavioralQuestions] requesting questions', {
    app_id: id,
    user_id: uid,
    force_refresh: forceRefresh,
  });

  const res = await aiClient.get(`/behavioral/questions?${params.toString()}`);
  const questions = (res.data.questions || []) as Question[];

  console.log(
    '[getBehavioralQuestions] received',
    questions.length,
    'questions for app_id',
    id,
    '— first question:',
    questions[0]?.question_text ?? '(none)',
  );

  return questions;
};

export const submitBehavioralAnswers = async (answers: unknown, appId?: string) => {
  const id = appId || sessionStorage.getItem('app_id') || 'default';
  const res = await aiClient.post('/behavioral/submit', { app_id: id, answers });
  return res.data;
};

// ─── Scholarships ─────────────────────────────────────────────────────────────

export const getMatchedScholarships = async (appId: string) => {
  try {
    const res = await apiClient.get(`/scholarships/${appId}/matches`);
    return res.data.matches || [];
  } catch {
    return [];
  }
};

export const listScholarships = async () => {
  try {
    const res = await apiClient.get('/scholarships/list');
    return res.data.scholarships || [];
  } catch {
    return [];
  }
};

// ─── Disbursal ────────────────────────────────────────────────────────────────

export const getDisbursalSchedule = async (appId: string) => {
  try {
    const res = await apiClient.get(`/disbursal/${appId}/schedule`);
    return res.data.schedule || [];
  } catch {
    return [];
  }
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function sendChatMessage(message: string, conversationId?: string, language = 'en') {
  const userId =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('user_id') ||
        (await import('@/store/authStore')).useAuthStore.getState().userId ||
        undefined
      : undefined;
  const res = await aiClient.post('/chat/message', {
    message,
    conversation_id: conversationId || `conv-${Date.now()}`,
    user_id: userId,
    language,
  });
  return res.data;
}

export async function sendChatStream(
  message: string,
  conversationId: string,
  onChunk: (text: string) => void,
  onDone: (sessionId?: string) => void,
  onError: (err: Error) => void
) {
  const userId =
    typeof window !== 'undefined' ? sessionStorage.getItem('user_id') ?? undefined : undefined;
  const sessionId =
    typeof window !== 'undefined' ? sessionStorage.getItem('chat_session') ?? undefined : undefined;

  // Try SSE streaming endpoint first
  try {
    const response = await fetch(`${AI_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_id: sessionId || conversationId,
        user_id: userId,
        language: 'en',
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let storedSessionId: string | undefined;
      while (!done) {
        const { done: d, value } = await reader.read();
        done = d;
        if (value) {
          for (const line of decoder.decode(value, { stream: true }).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') { done = true; break; }
            try {
              const parsed = JSON.parse(data) as { text?: string; session_id?: string };
              if (parsed.text) onChunk(parsed.text);
              if (parsed.session_id) storedSessionId = parsed.session_id;
            } catch {
              if (data) onChunk(data);
            }
          }
        }
      }
      if (storedSessionId && typeof window !== 'undefined') {
        sessionStorage.setItem('chat_session', storedSessionId);
      }
      onDone(storedSessionId);
      return;
    }
  } catch {
    // fall through to regular endpoint with simulated streaming
  }

  // Fallback: regular endpoint — output full response immediately
  try {
    const res = await aiClient.post('/chat/message', {
      message,
      conversation_id: sessionId || conversationId,
      user_id: userId,
      language: 'en',
    });
    const reply: string =
      res.data?.reply ||
      res.data?.response ||
      res.data?.message ||
      "Service temporarily unavailable. Please try again.";
    const sid: string | undefined = res.data?.session_id || res.data?.conversation_id;
    if (sid && typeof window !== 'undefined') sessionStorage.setItem('chat_session', sid);
    onChunk(reply);
    onDone(sid);
  } catch (err) {
    onError(err as Error);
  }
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getAuditTrail(appId: string) {
  try {
    const res = await apiClient.get(`/audit/${appId}/trail`);
    return res.data;
  } catch {
    return { events: [] };
  }
}

export async function createGrievance(data: { app_id?: string; subject: string; description: string }) {
  const res = await apiClient.post('/audit/grievance', data);
  return res.data;
}

// ─── Course ROI Predictor ──────────────────────────────────────────────────────

export interface ROIPrediction {
  course: string;
  institution: string;
  avg_salary_lpa: number;
  placement_probability: number;
  loan_payback_years: number;
  roi_score: number;
  career_paths: string[];
  salary_range: { min: number; max: number };
  ai_recommendation: string;
  risk_adjustment: 'LOW' | 'MEDIUM' | 'HIGH';
}

export async function getRoiPrediction(
  course: string,
  institution: string,
  loanAmount = 500000,
  category?: string
): Promise<ROIPrediction> {
  try {
    const res = await aiClient.post('/roi/predict', {
      course,
      institution,
      loan_amount: loanAmount,
      category,
    });
    return res.data as ROIPrediction;
  } catch {
    // Fallback heuristic when AI service is down
    return {
      course,
      institution,
      avg_salary_lpa: 8,
      placement_probability: 75,
      loan_payback_years: 2.5,
      roi_score: 7.2,
      career_paths: ['Graduate Officer', 'Research Associate', 'Government Services'],
      salary_range: { min: 5, max: 12 },
      ai_recommendation: 'Moderate ROI — explore skill development programs.',
      risk_adjustment: 'MEDIUM',
    };
  }
}
