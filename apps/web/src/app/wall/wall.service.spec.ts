import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Post, WallResponse } from './wall.models';
import { WALL_INCLUDE_HIDDEN, WallService } from './wall.service';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    name: 'Test',
    message: 'hello',
    type: 'livre',
    pinned: false,
    hidden: false,
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

  it('a rejected poll does not block the next one', async () => {
    const firstPage: WallResponse = {
      prompt: null,
      posts: [post({ id: 1 })],
      removedIds: [],
      serverTime: 1000,
    };
    let promise: Promise<void> = service.loadFirstPage();
    httpMock.expectOne('/api/wall').flush(firstPage);
    await promise;

    const firstPoll = service.poll();
    httpMock
      .expectOne((r) => r.params.get('since') === '1000')
      .error(new ProgressEvent('network error'));
    await firstPoll.catch(() => {});

    const delta: WallResponse = {
      prompt: null,
      posts: [post({ id: 1, upvotes: 9 })],
      removedIds: [],
      serverTime: 2000,
    };
    const secondPoll = service.poll();
    httpMock.expectOne((r) => r.params.get('since') === '1000').flush(delta);
    await secondPoll;

    expect(service.posts()[0].upvotes).toBe(9);
  });

  it('a poll started before an earlier one resolves runs only after it, using its up-to-date since=', async () => {
    const firstPage: WallResponse = {
      prompt: null,
      posts: [post({ id: 1 })],
      removedIds: [],
      serverTime: 1000,
    };
    let promise: Promise<void> = service.loadFirstPage();
    httpMock.expectOne('/api/wall').flush(firstPage);
    await promise;

    // Two overlapping poll() calls, e.g. the 5s interval and an admin save's immediate poll.
    const firstPoll = service.poll();
    const secondPoll = service.poll();

    // Only one request should be in flight until the first completes.
    const firstReq = httpMock.expectOne((r) => r.params.get('since') === '1000');
    httpMock.expectNone((r) => r.url === '/api/wall' && r.params.get('since') !== '1000');
    firstReq.flush({
      prompt: null,
      posts: [post({ id: 1, upvotes: 5 })],
      removedIds: [],
      serverTime: 2000,
    });
    await firstPoll;
    // The queued call's request fires one microtask after the first settles — let it flush.
    await Promise.resolve();

    // The second call's request only fires now, using the since= the first one just set.
    const secondReq = httpMock.expectOne((r) => r.params.get('since') === '2000');
    secondReq.flush({
      prompt: null,
      posts: [post({ id: 1, upvotes: 9 })],
      removedIds: [],
      serverTime: 3000,
    });
    await secondPoll;

    expect(service.posts()[0].upvotes).toBe(9);
  });

  it('a third poll queued behind two others still waits for its own turn', async () => {
    const firstPage: WallResponse = {
      prompt: null,
      posts: [post({ id: 1 })],
      removedIds: [],
      serverTime: 1000,
    };
    let promise: Promise<void> = service.loadFirstPage();
    httpMock.expectOne('/api/wall').flush(firstPage);
    await promise;

    // Three overlapping calls: if settling the first ever nulls out pollInFlight while the
    // second is still running, the third would fire concurrently with the second instead of
    // waiting its turn — the exact race this queue exists to close.
    const firstPoll = service.poll();
    const secondPoll = service.poll();
    const thirdPoll = service.poll();

    const firstReq = httpMock.expectOne((r) => r.params.get('since') === '1000');
    firstReq.flush({ prompt: null, posts: [], removedIds: [], serverTime: 2000 });
    await firstPoll;
    await Promise.resolve();

    const secondReq = httpMock.expectOne((r) => r.params.get('since') === '2000');
    httpMock.expectNone((r) => r.url === '/api/wall' && r.params.get('since') !== '2000');
    secondReq.flush({ prompt: null, posts: [], removedIds: [], serverTime: 3000 });
    await secondPoll;
    await Promise.resolve();

    const thirdReq = httpMock.expectOne((r) => r.params.get('since') === '3000');
    thirdReq.flush({
      prompt: null,
      posts: [post({ id: 1, upvotes: 4 })],
      removedIds: [],
      serverTime: 4000,
    });
    await thirdPoll;

    expect(service.posts()[0].upvotes).toBe(4);
  });

  it('never sends includeHidden by default — the public route stays unauthenticated-shaped', async () => {
    const promise = service.loadFirstPage();
    httpMock
      .expectOne((r) => r.url === '/api/wall' && !r.params.has('includeHidden'))
      .flush({
        prompt: null,
        posts: [],
        removedIds: [],
        serverTime: 1,
      });
    await promise;
  });
});

describe('WallService with WALL_INCLUDE_HIDDEN = true', () => {
  let service: WallService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WALL_INCLUDE_HIDDEN, useValue: true },
      ],
    });
    service = TestBed.inject(WallService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sends includeHidden=true on every fetch when the token is provided true', async () => {
    const promise = service.loadFirstPage();
    httpMock
      .expectOne((r) => r.params.get('includeHidden') === 'true')
      .flush({ prompt: null, posts: [], removedIds: [], serverTime: 1 });
    await promise;
  });
});
