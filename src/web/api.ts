import type { AssessmentDetail, AssessmentSummary, LoginRequest, Me } from '../shared/api';
import type { Answers } from '../shared/scoring';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new HttpError(res.status, data?.error ?? res.statusText, data?.details);
  return data as T;
}

export const api = {
  me: () => request<Me>('GET', '/api/auth/me'),
  login: (body: LoginRequest) => request<Me>('POST', '/api/auth/login', body),
  logout: () => request<{ ok: true }>('POST', '/api/auth/logout', {}),
  submitAssessment: (answers: Answers) => request<AssessmentDetail>('POST', '/api/assessments', { answers }),
  listAssessments: () => request<AssessmentSummary[]>('GET', '/api/assessments'),
  getAssessment: (id: string) => request<AssessmentDetail>('GET', `/api/assessments/${encodeURIComponent(id)}`),
};
