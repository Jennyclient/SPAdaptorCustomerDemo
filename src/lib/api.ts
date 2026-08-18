import type {
  BmMarket,
  CatalogEvent,
  FancyMarket,
} from '../types';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-API-Key': apiKey,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(
      err?.message || `HTTP ${res.status}`,
      res.status,
      err?.code,
    );
  }
  return body as T;
}

/** GET /v1/events — catalog list only (§6 step 1) */
export async function listEvents(
  baseUrl: string,
  apiKey: string,
  params: {
    sportId?: number;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ data: CatalogEvent[]; pagination?: { total?: number } }> {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));
  q.set('limit', String(params.limit ?? 50));
  if (params.sportId != null) q.set('sport_id', String(params.sportId));
  if (params.fromDate) q.set('from_date', params.fromDate);
  if (params.toDate) q.set('to_date', params.toDate);
  return request(baseUrl, apiKey, `/v1/events?${q}`);
}

/** GET /v1/events/:id — enabled markets metadata (§6 step 2) */
export async function getEventDetail(
  baseUrl: string,
  apiKey: string,
  eventId: string,
): Promise<CatalogEvent & { markets?: unknown[] }> {
  return request(baseUrl, apiKey, `/v1/events/${eventId}`);
}

/** GET /v1/events/:id/odds/bm (§6 step 3) */
export async function getBmOdds(
  baseUrl: string,
  apiKey: string,
  eventId: string,
): Promise<{ data: BmMarket[] }> {
  return request(baseUrl, apiKey, `/v1/events/${eventId}/odds/bm`);
}

/** GET /v1/events/:id/odds/fancy (§6 step 3) */
export async function getFancyOdds(
  baseUrl: string,
  apiKey: string,
  eventId: string,
): Promise<{ data: FancyMarket[] }> {
  return request(baseUrl, apiKey, `/v1/events/${eventId}/odds/fancy`);
}
