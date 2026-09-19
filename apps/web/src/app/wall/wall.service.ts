import { HttpClient, HttpParams } from '@angular/common/http';
import { InjectionToken, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Post, Prompt, WallResponse } from './wall.models';

/**
 * Whether this instance of `WallService` should ask the API for hidden posts too. Defaults to
 * `false` so the public `/` route (the app-wide singleton) never sends it; `AdminComponent`
 * re-provides both this token and a fresh `WallService` in its own `providers`, so `<app-wall>`
 * can be reused verbatim on `/admin` without touching the public singleton.
 */
export const WALL_INCLUDE_HIDDEN = new InjectionToken<boolean>('WALL_INCLUDE_HIDDEN', {
  factory: () => false,
});

/**
 * Holds the wall's state as an id-keyed map — not an array — so a poll delta can upsert or
 * remove a post without caring where it sits in the list; `posts` (below) derives the display
 * order fresh every time, which is what keeps a pin or an unhide from needing special-case
 * re-sorting logic.
 */
@Injectable({ providedIn: 'root' })
export class WallService {
  private readonly http = inject(HttpClient);
  private readonly includeHidden = inject(WALL_INCLUDE_HIDDEN);

  private readonly postsById = signal(new Map<number, Post>());
  private readonly promptSignal = signal<Prompt | null>(null);
  private readonly hasMoreSignal = signal(true);
  private readonly loadedSignal = signal(false);
  private lastServerTime = 0;

  readonly prompt = this.promptSignal.asReadonly();
  readonly hasMore = this.hasMoreSignal.asReadonly();
  /** False until the first page has actually loaded — lets the template tell "empty wall"
   * apart from "still loading", which would otherwise flash the empty state on every visit. */
  readonly loaded = this.loadedSignal.asReadonly();

  /** Pinned posts first, then newest first — recomputed on every change, never stored ordered. */
  readonly posts = computed(() =>
    [...this.postsById().values()].sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      if (a.createdAt !== b.createdAt) {
        return b.createdAt - a.createdAt;
      }
      return b.id - a.id;
    }),
  );

  async loadFirstPage(): Promise<void> {
    const response = await this.fetch();
    this.postsById.set(this.toMap(response.posts));
    this.promptSignal.set(response.prompt);
    this.hasMoreSignal.set(true);
    this.lastServerTime = response.serverTime;
    this.loadedSignal.set(true);
  }

  async loadMore(): Promise<void> {
    const cursor = this.oldestUnpinnedCursor();
    if (!cursor) {
      this.hasMoreSignal.set(false);
      return;
    }

    const response = await this.fetch(
      new HttpParams().set('before', cursor.createdAt).set('beforeId', cursor.id),
    );
    if (response.posts.length === 0) {
      this.hasMoreSignal.set(false);
      return;
    }
    this.upsert(response.posts);
  }

  async poll(): Promise<void> {
    const response = await this.fetch(new HttpParams().set('since', this.lastServerTime));
    this.upsert(response.posts);
    this.remove(response.removedIds);
    this.promptSignal.set(response.prompt);
    this.lastServerTime = response.serverTime;
  }

  private fetch(params: HttpParams = new HttpParams()): Promise<WallResponse> {
    const withVisibility = this.includeHidden ? params.set('includeHidden', true) : params;
    return firstValueFrom(this.http.get<WallResponse>('/api/wall', { params: withVisibility }));
  }

  private toMap(posts: Post[]): Map<number, Post> {
    return new Map(posts.map((post) => [post.id, post]));
  }

  private upsert(posts: Post[]): void {
    if (posts.length === 0) {
      return;
    }
    const next = new Map(this.postsById());
    for (const post of posts) {
      next.set(post.id, post);
    }
    this.postsById.set(next);
  }

  private remove(ids: number[]): void {
    if (ids.length === 0) {
      return;
    }
    const next = new Map(this.postsById());
    for (const id of ids) {
      next.delete(id);
    }
    this.postsById.set(next);
  }

  private oldestUnpinnedCursor(): { createdAt: number; id: number } | null {
    let oldest: Post | null = null;
    for (const post of this.postsById().values()) {
      if (post.pinned) {
        continue;
      }
      if (
        !oldest ||
        post.createdAt < oldest.createdAt ||
        (post.createdAt === oldest.createdAt && post.id < oldest.id)
      ) {
        oldest = post;
      }
    }
    return oldest ? { createdAt: oldest.createdAt, id: oldest.id } : null;
  }
}
