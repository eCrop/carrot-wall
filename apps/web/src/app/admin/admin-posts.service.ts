import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const GENERIC_ERROR = 'Não foi possível guardar a resposta. Tenta outra vez.';

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
}
