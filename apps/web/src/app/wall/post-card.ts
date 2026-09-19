import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AnswerEditorComponent } from '../admin/answer-editor';
import { ModerationControlsComponent } from '../admin/moderation-controls';
import { hasUpvoted, markUpvoted, unmarkUpvoted } from './upvoted-posts';
import { Post } from './wall.models';

const TYPE_LABELS: Record<string, string> = {
  'quero-aprender': 'Quero aprender',
  pergunta: 'Pergunta',
  frustração: 'Frustração',
  livre: 'Livre',
};

const RELATIVE_TIME = new Intl.RelativeTimeFormat('pt-PT', { numeric: 'auto' });
const ANSWER_TIME_OF_DAY = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' });
const ANSWER_DATE = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' });

/** A single post on the wall. Every text field renders via interpolation — never [innerHTML] —
 * so a message containing `<script>` reads as literal text (spec §7.12). */
@Component({
  selector: 'app-post-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AnswerEditorComponent, ModerationControlsComponent],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
})
export class PostCardComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly post = input.required<Post>();
  readonly highlighted = input(false);
  /** Only true on `/admin` (see WallComponent/AdminComponent) — reveals the "Responder"
   * editor. `/`'s cards never pass this, so their rendering is unchanged. */
  readonly admin = input(false);
  /** Only true on `/tv` — scales type up past 32px and renders the upvote count as plain text
   * instead of a button, since the projector has no pointer and nothing on it may be
   * interactive. */
  readonly tv = input(false);

  readonly authorName = computed(() => this.post().name ?? 'Anónimo');
  readonly typeLabel = computed(() => TYPE_LABELS[this.post().type] ?? this.post().type);
  readonly relativeTime = computed(() => formatRelativeTime(this.post().createdAt));
  readonly answerTime = computed(() => {
    const answerUpdatedAt = this.post().answerUpdatedAt;
    return answerUpdatedAt === null ? '' : formatAnswerTime(answerUpdatedAt);
  });

  /** Seeded from `localStorage` in `ngOnInit` rather than a field initializer or the
   * constructor — a required `input()` has no value yet at either of those points. Reading
   * `post()` once here (instead of in an `effect`) is safe because `@for (... track post.id)`
   * (wall.html, pinned-carousel.html) never reuses a card instance for a different post, so this
   * id can't change under a live component. */
  readonly voted = signal(false);
  /** Set the instant the button is clicked so the count moves before the request resolves; the
   * server's own count always wins once it catches up (spec: "responds immediately rather than
   * waiting for the next poll"). `Math.max` rather than clearing this back to `null` on poll,
   * since one browser can only ever vote once — there's no later state to clear it for. */
  private readonly optimisticUpvotes = signal<number | null>(null);
  readonly displayedUpvotes = computed(() => {
    const optimistic = this.optimisticUpvotes();
    return optimistic === null ? this.post().upvotes : Math.max(this.post().upvotes, optimistic);
  });

  ngOnInit(): void {
    this.voted.set(hasUpvoted(this.post().id));
  }

  upvote(): void {
    if (this.voted()) {
      return;
    }
    const id = this.post().id;
    this.voted.set(true);
    this.optimisticUpvotes.set(this.post().upvotes + 1);
    markUpvoted(id);

    firstValueFrom(this.http.post(`/api/posts/${id}/upvote`, null)).catch(() => {
      this.voted.set(false);
      this.optimisticUpvotes.set(null);
      unmarkUpvoted(id);
    });
  }
}

function formatRelativeTime(epochMillis: number): string {
  const diffSeconds = Math.round((epochMillis - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) {
    return RELATIVE_TIME.format(diffSeconds, 'second');
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return RELATIVE_TIME.format(diffMinutes, 'minute');
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return RELATIVE_TIME.format(diffHours, 'hour');
  }
  const diffDays = Math.round(diffHours / 24);
  return RELATIVE_TIME.format(diffDays, 'day');
}

/** Relative under 1h; `HH:mm` if answered today; `d MMM, HH:mm` for earlier days — unlike
 * {@link formatRelativeTime}, this never keeps shifting past the 1h mark, so an answer written
 * hours ago reads as a fixed, citable time rather than a relative one that ages awkwardly. */
function formatAnswerTime(epochMillis: number): string {
  const now = Date.now();
  const diffMinutes = Math.round((epochMillis - now) / 1000 / 60);
  if (Math.abs(diffMinutes) < 60) {
    return RELATIVE_TIME.format(diffMinutes, 'minute');
  }

  const answered = new Date(epochMillis);
  const today = new Date(now);
  const sameDay =
    answered.getFullYear() === today.getFullYear() &&
    answered.getMonth() === today.getMonth() &&
    answered.getDate() === today.getDate();

  if (sameDay) {
    return ANSWER_TIME_OF_DAY.format(answered);
  }
  return `${ANSWER_DATE.format(answered)}, ${ANSWER_TIME_OF_DAY.format(answered)}`;
}
