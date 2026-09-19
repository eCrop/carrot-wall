import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface PromptPreset {
  id: number;
  text: string;
}

const GENERIC_ERROR = 'Não foi possível mudar a pergunta. Tenta outra vez.';

@Injectable({ providedIn: 'root' })
export class AdminPromptService {
  private readonly http = inject(HttpClient);

  getPresets(): Promise<PromptPreset[]> {
    return firstValueFrom(this.http.get<PromptPreset[]>('/api/admin/prompts/presets'));
  }

  /** Activates a preset by id, or free-typed text — same PT-error-on-failure shape as
   * AdminPostsService.setAnswer, since the caller needs to show it. */
  async activate(request: { presetId: number } | { text: string }): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/admin/prompt', request));
    } catch (error) {
      if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
        throw new Error(error.error.message);
      }
      throw new Error(GENERIC_ERROR);
    }
  }
}
