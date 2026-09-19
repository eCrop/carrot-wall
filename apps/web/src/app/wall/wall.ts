import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';

import { PostCardComponent } from './post-card';
import { WallService } from './wall.service';

const POLL_INTERVAL_MS = 5000;

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

  readonly posts = this.wallService.posts;
  readonly prompt = this.wallService.prompt;
  readonly hasMore = this.wallService.hasMore;
  readonly loaded = this.wallService.loaded;

  ngOnInit(): void {
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
