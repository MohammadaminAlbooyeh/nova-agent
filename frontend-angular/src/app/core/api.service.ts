import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './config';

/** Pull the most useful message out of a failed HTTP call (FastAPI sends `detail`). */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const detail = err.error?.detail;
    if (typeof detail === 'string') return detail;
    if (err.status) return `API error: ${err.status}`;
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T = any>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return firstValueFrom(
      this.http.get<T>(`${API_BASE}${endpoint}`, { params: new HttpParams({ fromObject: params ?? {} }) }),
    );
  }

  post<T = any>(endpoint: string, body: unknown = {}, params?: Record<string, string>): Promise<T> {
    return firstValueFrom(
      this.http.post<T>(`${API_BASE}${endpoint}`, body, { params: new HttpParams({ fromObject: params ?? {} }) }),
    );
  }

  put<T = any>(endpoint: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${API_BASE}${endpoint}`, body));
  }

  delete<T = any>(endpoint: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${API_BASE}${endpoint}`));
  }
}
