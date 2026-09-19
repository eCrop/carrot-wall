import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Post } from './wall.models';

const TYPE_LABELS: Record<string, string> = {
  'quero-aprender': 'Quero aprender',
  pergunta: 'Pergunta',
  frustração: 'Frustração',
  livre: 'Livre',
};

const RELATIVE_TIME = new Intl.RelativeTimeFormat('pt-PT', { numeric: 'auto' });

/** A single post on the wall. Every text field renders via interpolation — never [innerHTML] —
 * so a message containing `<script>` reads as literal text (spec §7.12). */
@Component({
  selector: 'app-post-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
})
export class PostCardComponent {
  readonly post = input.required<Post>();

  readonly authorName = computed(() => this.post().name ?? 'Anónimo');
  readonly typeLabel = computed(() => TYPE_LABELS[this.post().type] ?? this.post().type);
  readonly relativeTime = computed(() => formatRelativeTime(this.post().createdAt));
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
