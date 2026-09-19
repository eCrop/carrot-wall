import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Post } from '../wall/wall.models';
import { WallService } from '../wall/wall.service';
import { AdminPostsService } from './admin-posts.service';

const MAX_ANSWER_LENGTH = 1000;

/**
 * The per-card "Responder" control on `/admin`, collapsed by default. Kept out of
 * `PostCardComponent` itself so the public card's zero-config test setup (no
 * `TestBed.configureTestingModule` at all today) doesn't have to grow HTTP testing scaffolding
 * for a control `/` never renders.
 */
@Component({
  selector: 'app-answer-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './answer-editor.html',
  styleUrl: './answer-editor.scss',
})
export class AnswerEditorComponent {
  private readonly adminPosts = inject(AdminPostsService);
  private readonly wallService = inject(WallService);

  readonly post = input.required<Post>();
  readonly maxAnswerLength = MAX_ANSWER_LENGTH;

  readonly expanded = signal(false);
  readonly text = signal('');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly remaining = computed(() => this.maxAnswerLength - this.text().length);
  readonly canSave = computed(() => !this.submitting() && this.remaining() >= 0);

  toggle(): void {
    if (this.expanded()) {
      this.collapse();
      return;
    }
    this.text.set(this.post().answerText ?? '');
    this.error.set(null);
    this.expanded.set(true);
  }

  cancel(): void {
    this.collapse();
  }

  save(): void {
    const trimmed = this.text().trim();
    if (trimmed.length > this.maxAnswerLength) {
      this.error.set(`O texto da resposta pode ter no máximo ${this.maxAnswerLength} caracteres.`);
      return;
    }

    this.error.set(null);
    this.submitting.set(true);

    this.adminPosts.setAnswer(this.post().id, trimmed).then(
      () => {
        this.submitting.set(false);
        this.collapse();
        void this.wallService.poll();
      },
      (err: unknown) => {
        this.submitting.set(false);
        this.error.set(err instanceof Error ? err.message : 'Não foi possível guardar a resposta.');
      },
    );
  }

  private collapse(): void {
    this.expanded.set(false);
    this.text.set('');
    this.error.set(null);
  }
}
