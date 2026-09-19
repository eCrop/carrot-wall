import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Post, WallResponse } from './wall.models';
import { WallService } from './wall.service';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    name: 'Test',
    message: 'hello',
    type: 'livre',
    pinned: false,
    upvotes: 0,
    createdAt: 1000,
    answerText: null,
    answerUpdatedAt: null,
    ...overrides,
  };
}

describe('WallService', () => {
  let service: WallService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WallService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the first page into posts and prompt', async () => {
    const response: WallResponse = {
      prompt: { id: 1, text: 'Prompt' },
      posts: [post({ id: 1 })],
      removedIds: [],
      serverTime: 5000,
    };

    const promise = service.loadFirstPage();
    httpMock.expectOne('/api/wall').flush(response);
    await promise;

    expect(service.posts().map((p) => p.id)).toEqual([1]);
    expect(service.prompt()?.text).toBe('Prompt');
  });

  it('orders pinned posts before unpinned, newest first within each group', async () => {
    const response: WallResponse = {
      prompt: null,
      posts: [
        post({ id: 1, createdAt: 2000, pinned: false }),
        post({ id: 2, createdAt: 3000, pinned: true }),
        post({ id: 3, createdAt: 4000, pinned: false }),
      ],
      removedIds: [],
      serverTime: 5000,
    };

    const promise = service.loadFirstPage();
    httpMock.expectOne('/api/wall').flush(response);
    await promise;

    expect(service.posts().map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it('poll upserts changed posts and removes hidden ones by id', async () => {
    const firstPage: WallResponse = {
      prompt: null,
      posts: [post({ id: 1, upvotes: 0 }), post({ id: 2 })],
      removedIds: [],
      serverTime: 1000,
    };
    let promise: Promise<void> = service.loadFirstPage();
    httpMock.expectOne('/api/wall').flush(firstPage);
    await promise;

    const delta: WallResponse = {
      prompt: null,
      posts: [post({ id: 1, upvotes: 5 })],
      removedIds: [2],
      serverTime: 2000,
    };
    promise = service.poll();
    httpMock.expectOne((r) => r.params.get('since') === '1000').flush(delta);
    await promise;

    expect(service.posts().map((p) => p.id)).toEqual([1]);
    expect(service.posts()[0].upvotes).toBe(5);
  });

  it('a poll re-sending an already-loaded id does not duplicate the card', async () => {
    const firstPage: WallResponse = {
      prompt: null,
      posts: [post({ id: 1 })],
      removedIds: [],
      serverTime: 1000,
    };
    let promise: Promise<void> = service.loadFirstPage();
    httpMock.expectOne('/api/wall').flush(firstPage);
    await promise;

    // Simulates the since= >= boundary re-sending a post the client already has.
    const delta: WallResponse = {
      prompt: null,
      posts: [post({ id: 1 })],
      removedIds: [],
      serverTime: 1000,
    };
    promise = service.poll();
    httpMock.expectOne((r) => r.params.get('since') === '1000').flush(delta);
    await promise;

    expect(service.posts().length).toBe(1);
  });

  it('loadMore uses the oldest loaded unpinned post as the cursor', async () => {
    const firstPage: WallResponse = {
      prompt: null,
      posts: [
        post({ id: 1, createdAt: 3000 }),
        post({ id: 2, createdAt: 1000 }), // oldest unpinned — must become the cursor
        post({ id: 3, createdAt: 2000, pinned: true }), // pinned: never the cursor source
      ],
      removedIds: [],
      serverTime: 5000,
    };
    let promise: Promise<void> = service.loadFirstPage();
    httpMock.expectOne('/api/wall').flush(firstPage);
    await promise;

    promise = service.loadMore();
    httpMock
      .expectOne((r) => r.params.get('before') === '1000' && r.params.get('beforeId') === '2')
      .flush({
        prompt: null,
        posts: [post({ id: 4, createdAt: 500 })],
        removedIds: [],
        serverTime: 5000,
      });
    await promise;

    expect(service.posts().map((p) => p.id)).toContain(4);
  });

  it('loadMore sets hasMore to false when the server returns an empty page', async () => {
    const firstPage: WallResponse = {
      prompt: null,
      posts: [post({ id: 1, createdAt: 1000 })],
      removedIds: [],
      serverTime: 5000,
    };
    let promise: Promise<void> = service.loadFirstPage();
    httpMock.expectOne('/api/wall').flush(firstPage);
    await promise;

    promise = service.loadMore();
    httpMock
      .expectOne((r) => r.params.has('before'))
      .flush({ prompt: null, posts: [], removedIds: [], serverTime: 5000 });
    await promise;

    expect(service.hasMore()).toBe(false);
  });
});
