import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, map, of } from 'rxjs';

/**
 * Both calls resolve to a plain boolean, never a rejection — `AdminComponent` only ever needs
 * "am I in or not". Mapped to `true`/`false` explicitly rather than checking the response body
 * for truthiness: both endpoints return an empty body on success, which Angular's HttpClient
 * parses as `null` — indistinguishable from a caught error if `null` were used as the sentinel.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);

  checkSession(): Promise<boolean> {
    return firstValueFrom(
      this.http.get('/api/admin/session').pipe(
        map(() => true),
        catchError(() => of(false)),
      ),
    );
  }

  login(pin: string): Promise<boolean> {
    return firstValueFrom(
      this.http.post('/api/admin/login', { pin }).pipe(
        map(() => true),
        catchError(() => of(false)),
      ),
    );
  }
}
