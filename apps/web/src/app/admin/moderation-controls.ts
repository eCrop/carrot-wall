import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';

import { Post } from '../wall/wall.models';
import { WallService } from '../wall/wall.service';
import { AdminPostsService } from './admin-posts.service';

/**
 * The per-card Fixar/Ocultar controls on `/admin`. Kept out of `PostCardComponent` for the same
 * reason `AnswerEditorComponent` is — `post-card.spec.ts` stays free of HTTP interaction tests.
 * Each button is a bare toggle: no confirmation, no form, refresh happens via the same
 * poll-after-write pattern `AnswerEditorComponent` already uses rather than a local upsert.
 */
@Component({
  selector: 'app-moderation-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './moderation-controls.html',
  styleUrl: './moderation-controls.scss',
})
export class ModerationControlsComponent {
  private readonly adminPosts = inject(AdminPostsService);
  private readonly wallService = inject(WallService);

  readonly post = input.required<Post>();

  readonly pinning = signal(false);
  readonly hiding = signal(false);
  readonly error = signal<string | null>(null);

  togglePin(): void {
    const post = this.post();
    this.run(this.pinning, () =>
      post.pinned ? this.adminPosts.unpin(post.id) : this.adminPosts.pin(post.id),
    );
  }

  toggleHidden(): void {
    const post = this.post();
    this.run(this.hiding, () =>
      post.hidden ? this.adminPosts.unhide(post.id) : this.adminPosts.hide(post.id),
    );
  }

  /** Guards against a double-tap firing a second request while the first is still in flight —
   * the check and the flip to `true` must happen before the request starts, not after, so
   * `action` is only invoked once the guard has already passed. */
  private run(busy: ReturnType<typeof signal<boolean>>, action: () => Promise<void>): void {
    if (busy()) {
      return;
    }
    this.error.set(null);
    busy.set(true);
    action().then(
      () => {
        busy.set(false);
        void this.wallService.poll();
      },
      (err: unknown) => {
        busy.set(false);
        this.error.set(
          err instanceof Error ? err.message : 'Não foi possível guardar a alteração.',
        );
      },
    );
  }
}
