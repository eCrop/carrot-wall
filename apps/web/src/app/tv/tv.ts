import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
} from '@angular/core';

import { PinnedCarouselComponent } from '../wall/pinned-carousel';
import { WallService } from '../wall/wall.service';
import { buildQrCells } from './qr';

const POLL_INTERVAL_MS = 5000;
const PAGE_TURN_INTERVAL_MS = 8000;
const UNPINNED_PAGE_SIZE = 3;

/**
 * The projector view: the active prompt as a large heading, a pinned slot and a row of
 * unpinned cards each cycling on `PinnedCarouselComponent` (built in slice 05 specifically for
 * this reuse), and a permanent QR pointing at `/post`. Read-only — no admin controls, no
 * interactive elements at all, since nobody stands at the projector (spec F7).
 */
@Component({
  selector: 'app-tv',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PinnedCarouselComponent],
  templateUrl: './tv.html',
  styleUrl: './tv.scss',
})
export class TvComponent implements OnInit {
  private readonly wallService = inject(WallService);
  private readonly destroyRef = inject(DestroyRef);

  readonly prompt = this.wallService.prompt;
  readonly loaded = this.wallService.loaded;
  readonly posts = this.wallService.posts;

  /** `posts` is already pinned-first (see WallService) — plain filters, not a second sort. */
  readonly pinnedPosts = computed(() => this.posts().filter((post) => post.pinned));
  readonly unpinnedPosts = computed(() => this.posts().filter((post) => !post.pinned));

  readonly pageSize = UNPINNED_PAGE_SIZE;
  readonly pageTurnIntervalMs = PAGE_TURN_INTERVAL_MS;

  /** Computed once — the origin can't change at runtime, unlike the reactive data above. */
  readonly postUrl = `${location.origin}/post`;
  readonly qrCells = buildQrCells(this.postUrl);

  ngOnInit(): void {
    // Same poll-loop shape as WallComponent.ngOnInit: the interval starts before the first
    // load, so a slow or failing first request doesn't leave the screen dead until a reload.
    const intervalId = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));

    void this.tick();
  }

  private async tick(): Promise<void> {
    try {
      if (!this.wallService.loaded()) {
        await this.wallService.loadFirstPage();
      } else {
        await this.wallService.poll();
      }
    } catch {
      // Swallow: the next interval tick retries — same reasoning as WallComponent.tick().
    }
  }
}
