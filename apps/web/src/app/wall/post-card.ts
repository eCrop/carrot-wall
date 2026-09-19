import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AnswerEditorComponent } from '../admin/answer-editor';
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
  imports: [AnswerEditorComponent],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
})
export class PostCardComponent {
  readonly post = input.required<Post>();
  readonly highlighted = input(false);
  /** Only true on `/admin` (see WallComponent/AdminComponent) — reveals the "Responder"
   * editor. `/`'s cards never pass this, so their rendering is unchanged. */
  readonly admin = input(false);

  readonly authorName = computed(() => this.post().name ?? 'Anónimo');
  readonly typeLabel = computed(() => TYPE_LABELS[this.post().type] ?? this.post().type);
  readonly relativeTime = computed(() => formatRelativeTime(this.post().createdAt));
  readonly answerTime = computed(() => {
    const answerUpdatedAt = this.post().answerUpdatedAt;
    return answerUpdatedAt === null ? '' : formatAnswerTime(answerUpdatedAt);
  });
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
