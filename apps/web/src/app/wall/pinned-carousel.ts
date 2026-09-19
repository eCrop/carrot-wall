import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { PostCardComponent } from './post-card';
import { Post } from './wall.models';

const PAGE_SIZE = 3;
const ADVANCE_INTERVAL_MS = 6000;

/**
 * The pinned-posts strip on the public wall: a page of up to {@link PAGE_SIZE} cards at a time,
 * auto-advancing every 6s, pausable, and dropped entirely when there's nothing pinned. Built
 * standalone (no filtering/sorting of its own — `posts` must already be pinned-and-ordered by
 * the caller) so slice 08's `/tv` can reuse it unchanged with a different `posts` source.
 */
@Component({
  selector: 'app-pinned-carousel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PostCardComponent],
  templateUrl: './pinned-carousel.html',
  styleUrl: './pinned-carousel.scss',
})
export class PinnedCarouselComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly posts = input.required<Post[]>();

  readonly pages = computed(() => chunk(this.posts(), PAGE_SIZE));
  readonly currentPage = signal(0);
  readonly currentPosts = computed(() => this.pages()[this.currentPage()] ?? []);

  private readonly paused = signal(false);
  /** Read once at construction, same as `post-card.scss`'s static `prefers-reduced-motion`
   * media query — a mid-session OS toggle takes effect on next reload, not live. */
  private readonly reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    // Clamp back onto a valid page whenever a post gets unpinned mid-cycle and the page count
    // shrinks — otherwise currentPage could point past the end of a now-shorter pages() array.
    effect(() => {
      const lastPage = Math.max(0, this.pages().length - 1);
      if (this.currentPage() > lastPage) {
        this.currentPage.set(lastPage);
      }
    });

    if (this.reducedMotion) {
      return;
    }

    const intervalId = setInterval(() => this.advance(), ADVANCE_INTERVAL_MS);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  goTo(page: number): void {
    this.currentPage.set(page);
  }

  pause(): void {
    this.paused.set(true);
  }

  resume(): void {
    this.paused.set(false);
  }

  private advance(): void {
    if (this.paused()) {
      return;
    }
    const pageCount = this.pages().length;
    if (pageCount === 0) {
      return;
    }
    this.currentPage.set((this.currentPage() + 1) % pageCount);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}
