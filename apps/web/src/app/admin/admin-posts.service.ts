import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const GENERIC_ERROR = 'Não foi possível guardar a alteração. Tenta outra vez.';

@Injectable({ providedIn: 'root' })
export class AdminPostsService {
  private readonly http = inject(HttpClient);

  /** Blank text clears the answer — same rule as the server. Rejects with a PT error message
   * on failure, since (unlike AdminAuthService's true/false) the caller needs to show it. */
  async setAnswer(id: number, answerText: string): Promise<void> {
    try {
      await firstValueFrom(this.http.put(`/api/admin/posts/${id}/answer`, { answerText }));
    } catch (error) {
      if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
        throw new Error(error.error.message);
      }
      throw new Error(GENERIC_ERROR);
    }
  }

  pin(id: number): Promise<void> {
    return this.toggle(id, 'pin');
  }

  unpin(id: number): Promise<void> {
    return this.toggle(id, 'unpin');
  }

  hide(id: number): Promise<void> {
    return this.toggle(id, 'hide');
  }

  unhide(id: number): Promise<void> {
    return this.toggle(id, 'unhide');
  }

  private async toggle(id: number, action: 'pin' | 'unpin' | 'hide' | 'unhide'): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`/api/admin/posts/${id}/${action}`, null));
    } catch (error) {
      if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
        throw new Error(error.error.message);
      }
      throw new Error(GENERIC_ERROR);
    }
  }
}
