// 실제 서버 구현. api.md 1장 공통 규칙(주소, Bearer 기기 토큰, 오류 형식)과 3장 엔드포인트.
import { Platform as RNPlatform } from 'react-native';

import type { Api } from './client';
import { ApiError } from './errors';
import { clearToken, loadToken, saveToken } from './tokenStore';
import type {
  ConsentRequest,
  CreateFamilyRequest,
  CreateFamilyResponse,
  DetectResponse,
  Device,
  DoseEvent,
  ErrorBody,
  Handoff,
  HandoffListItem,
  Health,
  Layout,
  LocalPhoto,
  Me,
  MockScenario,
  MockScenarioResponse,
  PairingCode,
  PairRequest,
  PairResponse,
  Photo,
  Pillbox,
  PillboxCurrent,
  Refill,
  Schedule,
  Settings,
  SlotInput,
  Summary,
  TodayResponse,
  UploadResponse,
  Verdict,
} from './types';

/** 판독을 기다리는 요청(3.10, 3.15, 3.18)은 서버가 최대 60초 걸린다. 여유를 둔다 */
const READING_TIMEOUT_MS = 90_000;
const DEFAULT_TIMEOUT_MS = 20_000;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  form?: FormData;
  auth?: boolean;
  timeoutMs?: number;
}

class HttpApi implements Api {
  readonly mode = 'http' as const;
  private listeners = new Set<() => void>();
  private authListeners = new Set<() => void>();
  private token: string | null | undefined;

  /** baseUrl 은 `/api/v1` 까지 포함한 주소. `/health` 는 그 앞(루트)에 있다 (1.1) */
  constructor(private readonly baseUrl: string) {}

  subscribe(l: () => void) {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  }

  onAuthLost(l: () => void) {
    this.authListeners.add(l);
    return () => void this.authListeners.delete(l);
  }

  private changed() {
    this.listeners.forEach((l) => l());
  }

  private async getToken() {
    if (this.token === undefined) this.token = await loadToken();
    return this.token;
  }

  private async setToken(token: string) {
    this.token = token;
    await saveToken(token);
  }

  async hasToken() {
    return !!(await this.getToken());
  }

  async forgetToken() {
    this.token = null;
    await clearToken();
  }

  private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, form, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth) {
      const token = await this.getToken();
      if (!token) throw new ApiError(401, 'unauthorized', '토큰 없음');
      headers.Authorization = `Bearer ${token}`;
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';

    const url = path === '/health' ? `${this.baseUrl.replace(/\/api\/v1\/?$/, '')}/health` : `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
        signal: controller.signal,
      });
    } catch (e) {
      throw new ApiError(0, 'network_error', e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const json = text ? safeJson(text) : null;

    if (!res.ok) {
      const err = (json as ErrorBody | null)?.error;
      const apiError = new ApiError(res.status, err?.code ?? 'internal_error', err?.message ?? res.statusText, {
        ...(err?.details ?? {}),
        retry_after: res.headers.get('Retry-After'),
      });
      // 5장: 토큰이 없거나 해제됐으면 저장된 토큰을 지우고 첫 화면으로
      if (auth && res.status === 401) {
        await this.forgetToken();
        this.authListeners.forEach((l) => l());
      }
      throw apiError;
    }
    if (method !== 'GET') this.changed();
    return json as T;
  }

  health() {
    return this.request<Health>('/health', { auth: false });
  }

  async createFamily(req: CreateFamilyRequest) {
    const res = await this.request<CreateFamilyResponse>('/families', { method: 'POST', body: req, auth: false });
    await this.setToken(res.token);
    return res;
  }

  createPairingCode(kind: 'elder' | 'guardian') {
    return this.request<PairingCode>('/pairing-codes', { method: 'POST', body: { kind } });
  }

  async pair(req: PairRequest) {
    const res = await this.request<PairResponse>('/pair', { method: 'POST', body: req, auth: false });
    await this.setToken(res.token);
    return res;
  }

  consent(req: ConsentRequest) {
    return this.request<{ consent_at: string }>('/consent', { method: 'POST', body: req });
  }

  me() {
    return this.request<Me>('/me');
  }

  async devices() {
    return (await this.request<{ items: Device[] }>('/devices')).items;
  }

  async deleteDevice(id: string) {
    const mine = (await this.devices()).find((d) => d.is_me)?.id === id;
    await this.request<void>(`/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (mine) await this.forgetToken();
  }

  putPushToken(pushToken: string | null) {
    return this.request<void>('/devices/me/push-token', { method: 'PUT', body: { push_token: pushToken } });
  }

  async detectPillbox(photo: LocalPhoto) {
    return this.request<DetectResponse>('/pillboxes/detect', { method: 'POST', form: await photoForm(photo), timeoutMs: READING_TIMEOUT_MS });
  }

  createPillbox(req: { photo_id: string; layout: Layout }) {
    return this.request<{ pillbox: Pillbox; refill: Refill }>('/pillboxes', { method: 'POST', body: req, timeoutMs: READING_TIMEOUT_MS });
  }

  currentPillbox() {
    return this.request<PillboxCurrent>('/pillboxes/current');
  }

  schedule() {
    return this.request<Schedule>('/schedule');
  }

  putSchedule(slots: SlotInput[]) {
    return this.request<Schedule>('/schedule', { method: 'PUT', body: { slots } });
  }

  async createRefill(photo: LocalPhoto) {
    return this.request<Refill>('/refills', { method: 'POST', form: await photoForm(photo), timeoutMs: READING_TIMEOUT_MS });
  }

  updateBaseline(refillId: string, cells: { cell_id: string; state: 'full' | 'empty' }[]) {
    return this.request<Refill>(`/refills/${encodeURIComponent(refillId)}/baseline`, { method: 'PUT', body: { cells } });
  }

  today() {
    return this.request<TodayResponse>('/dose-events/today');
  }

  async uploadDosePhoto(eventId: string, photo: LocalPhoto, clientUploadId: string) {
    const form = await photoForm(photo);
    form.append('client_upload_id', clientUploadId);
    return this.request<UploadResponse>(`/dose-events/${encodeURIComponent(eventId)}/photo`, {
      method: 'POST',
      form,
      timeoutMs: READING_TIMEOUT_MS,
    });
  }

  async doseEvents(from: string, to: string) {
    const q = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    return (await this.request<{ items: DoseEvent[] }>(`/dose-events?${q}`)).items;
  }

  async handoffs(status: 'open' | 'closed' | 'all' = 'open') {
    return (await this.request<{ items: HandoffListItem[] }>(`/handoffs?status=${status}`)).items;
  }

  handoff(id: string) {
    return this.request<Handoff>(`/handoffs/${encodeURIComponent(id)}`);
  }

  verdict(handoffId: string, verdict: Verdict) {
    return this.request<Handoff>(`/handoffs/${encodeURIComponent(handoffId)}/verdict`, { method: 'POST', body: { verdict } });
  }

  photo(id: string) {
    return this.request<Photo>(`/photos/${encodeURIComponent(id)}`);
  }

  async summaries(period: 'day' | 'week', from?: string, to?: string) {
    const q = [`period=${period}`, from && `from=${from}`, to && `to=${to}`].filter(Boolean).join('&');
    return (await this.request<{ items: Summary[] }>(`/summaries?${q}`)).items;
  }

  settings() {
    return this.request<Settings>('/settings');
  }

  putSettings(patch: Partial<Settings>) {
    return this.request<Settings>('/settings', { method: 'PUT', body: patch });
  }

  simulateDose(slotId: string) {
    return this.request<DoseEvent>('/dev/dose-events', { method: 'POST', body: { slot_id: slotId } });
  }

  setMockScenario(scenario: MockScenario | null) {
    return this.request<MockScenarioResponse>('/dev/mock-scenario', { method: 'POST', body: { scenario } });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** multipart 본문: photo(필수) + taken_at (3.10, 3.15, 3.18) */
async function photoForm(photo: LocalPhoto): Promise<FormData> {
  if (!photo.uri) throw new ApiError(0, 'no_photo', '올릴 사진이 없음');
  const form = new FormData();
  if (RNPlatform.OS === 'web') {
    // 웹에서는 카메라 결과가 data/blob URL 이라 Blob 으로 바꿔서 보낸다
    const blob = await (await fetch(photo.uri)).blob();
    form.append('photo', blob, 'photo.jpg');
  } else {
    // React Native 의 FormData 는 { uri, name, type } 객체를 파일로 보낸다
    form.append('photo', { uri: photo.uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  form.append('taken_at', photo.taken_at);
  return form;
}

export function createHttpApi(baseUrl: string): Api {
  return new HttpApi(baseUrl.replace(/\/$/, ''));
}
