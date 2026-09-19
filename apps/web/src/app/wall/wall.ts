import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { PostCardComponent } from './post-card';
import { WallService } from './wall.service';

const POLL_INTERVAL_MS = 5000;
const HIGHLIGHT_DURATION_MS = 2000;

/** The wall itself: prompt banner, card grid, "load more". Polls every 5s — no websockets,
 * the room is about fifteen clients (spec §4/constraints). */
@Component({
  selector: 'app-wall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PostCardComponent],
  templateUrl: './wall.html',
  styleUrl: './wall.scss',
})
export class WallComponent implements OnInit {
  private readonly wallService = inject(WallService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly posts = this.wallService.posts;
  readonly prompt = this.wallService.prompt;
  readonly hasMore = this.wallService.hasMore;
  readonly loaded = this.wallService.loaded;

  /** The id from `?highlight=<id>` (see PostComponent), while its coral ring is showing. */
  readonly highlightedPostId = signal<number | null>(null);
  private highlightTimerStarted = false;

  constructor() {
    // Waits for the highlighted post to actually be in the loaded list before starting the
    // 2s clock and clearing the URL: on a fresh submit the redirect can land here before
    // loadFirstPage()'s response — landing the ring on a post that isn't rendered yet would
    // silently do nothing.
    effect(() => {
      const id = this.highlightedPostId();
      if (id === null) {
        this.highlightTimerStarted = false;
        return;
      }
      if (this.highlightTimerStarted || !this.posts().some((post) => post.id === id)) {
        return;
      }

      this.highlightTimerStarted = true;
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      setTimeout(() => this.highlightedPostId.set(null), HIGHLIGHT_DURATION_MS);
    });
  }

  ngOnInit(): void {
    const raw = this.route.snapshot.queryParamMap.get('highlight');
    const id = raw === null ? Number.NaN : Number(raw);
    if (!Number.isNaN(id)) {
      this.highlightedPostId.set(id);
    }

    // The interval is set up before the first load, not after: if loadFirstPage() rejects
    // (the API not being up yet, a dev-mode reload mid-request), the wall must keep retrying
    // rather than going dead until someone refreshes the tab.
    const intervalId = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));

    void this.tick();
  }

  loadMore(): void {
    void this.wallService.loadMore();
  }

  private async tick(): Promise<void> {
    try {
      if (!this.wallService.loaded()) {
        await this.wallService.loadFirstPage();
      } else {
        await this.wallService.poll();
      }
    } catch {
      // Swallow: the next interval tick retries. A polling wall silently missing one
      // round-trip is normal; throwing here would only spam the console.
    }
  }
}
