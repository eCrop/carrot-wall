import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { PostCardComponent } from './post-card';
import { Post } from './wall.models';

const DEFAULT_PAGE_SIZE = 3;
const DEFAULT_ADVANCE_INTERVAL_MS = 6000;

/**
 * The pinned-posts strip on the public wall: a page of up to {@link pageSize} cards at a time,
 * auto-advancing every {@link intervalMs}, pausable, and dropped entirely when there's nothing
 * pinned. Built standalone (no filtering/sorting of its own — `posts` must already be
 * pinned-and-ordered by the caller) so slice 08's `/tv` can reuse it unchanged with a different
 * `posts` source, page size, interval, and no interactivity at all.
 */
@Component({
  selector: 'app-pinned-carousel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PostCardComponent],
  templateUrl: './pinned-carousel.html',
  styleUrl: './pinned-carousel.scss',
})
export class PinnedCarouselComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly posts = input.required<Post[]>();
  readonly pageSize = input(DEFAULT_PAGE_SIZE);
  readonly intervalMs = input(DEFAULT_ADVANCE_INTERVAL_MS);
  /** False on `/tv`: no dot buttons, no hover/focus pause — the projector has no pointer and
   * must never be left frozen by a stray mouseenter. */
  readonly interactive = input(true);
  /** Passed straight through to every card it renders — see `PostCardComponent`. */
  readonly tv = input(false);

  readonly pages = computed(() => chunk(this.posts(), this.pageSize()));
  readonly currentPage = signal(0);
  readonly currentPosts = computed(() => this.pages()[this.currentPage()] ?? []);

  private readonly paused = signal(false);
  /** Read once at construction, same as `post-card.scss`'s static `prefers-reduced-motion`
   * media query — a mid-session OS toggle takes effect on next reload, not live. Ignored when
   * `interactive` is false: on `/tv` there is no viewer who can operate a pause/dot control, so
   * honoring the setting would just freeze the projector on page 1 forever rather than offer an
   * accessible alternative — the failure mode is worse than the motion. */
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
  }

  ngOnInit(): void {
    // Interval creation waits for ngOnInit, not the constructor: signal inputs aren't bound yet
    // at construction time, so reading `intervalMs()` there would silently fall back to its
    // default and `/tv`'s 8s interval would never take effect.
    if (this.reducedMotion && this.interactive()) {
      return;
    }

    const intervalId = setInterval(() => this.advance(), this.intervalMs());
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  goTo(page: number): void {
    this.currentPage.set(page);
  }

  pause(): void {
    if (!this.interactive()) {
      return;
    }
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
