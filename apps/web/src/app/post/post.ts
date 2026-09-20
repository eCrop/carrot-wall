import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { getClientToken } from '../client-token';

export type PostType = 'quero-aprender' | 'pergunta' | 'frustração' | 'livre';

interface TypeOption {
  value: PostType;
  label: string;
  emoji: string;
}

interface CreatedPost {
  id: number;
}

const TYPE_OPTIONS: readonly TypeOption[] = [
  { value: 'quero-aprender', label: 'Quero aprender', emoji: '💡' },
  { value: 'pergunta', label: 'Pergunta', emoji: '❓' },
  { value: 'frustração', label: 'Frustração', emoji: '😤' },
  { value: 'livre', label: 'Livre', emoji: '💬' },
];

const MAX_MESSAGE_LENGTH = 280;
const MAX_NAME_LENGTH = 40;
const EMPTY_MESSAGE_ERROR = 'Escreve qualquer coisa antes de enviar.';
const RATE_LIMIT_ERROR = 'Calma aí — espera um bocadinho antes de escreveres outra vez.';
const GENERIC_ERROR = 'Não foi possível enviar. Tenta outra vez.';

/**
 * Client-side checks here are a courtesy only — `POST /api/posts` is the source of truth and
 * re-validates everything (trim, length, type) itself.
 */
@Component({
  selector: 'app-post',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './post.html',
  styleUrl: './post.scss',
})
export class PostComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly typeOptions = TYPE_OPTIONS;
  readonly maxMessageLength = MAX_MESSAGE_LENGTH;
  readonly maxNameLength = MAX_NAME_LENGTH;

  readonly message = signal('');
  readonly name = signal('');
  readonly type = signal<PostType>('livre');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly remaining = computed(() => this.maxMessageLength - this.message().length);
  // Not gated on message length: an empty submit must still be clickable so submit() can show
  // the inline PT error (spec criterion 3) rather than silently disabling the only way to
  // trigger it.
  readonly canSubmit = computed(() => !this.submitting());

  selectType(value: PostType): void {
    this.type.set(value);
  }

  submit(): void {
    const message = this.message().trim();
    if (!message) {
      this.error.set(EMPTY_MESSAGE_ERROR);
      return;
    }

    this.error.set(null);
    this.submitting.set(true);

    this.http
      .post<CreatedPost>(
        '/api/posts',
        { name: this.name().trim(), message, type: this.type() },
        { headers: { 'X-Client-Token': getClientToken() } },
      )
      .subscribe({
        next: (post) => {
          this.router.navigate(['/'], { queryParams: { highlight: post.id } });
        },
        error: (response: HttpErrorResponse) => {
          this.submitting.set(false);
          this.error.set(response.status === 429 ? RATE_LIMIT_ERROR : GENERIC_ERROR);
        },
      });
  }
}
