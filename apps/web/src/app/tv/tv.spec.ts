import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { PinnedCarouselComponent } from '../wall/pinned-carousel';
import { Post, WallResponse } from '../wall/wall.models';
import { TvComponent } from './tv';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    name: 'Rita',
    message: 'Olá',
    type: 'livre',
    pinned: false,
    hidden: false,
    upvotes: 0,
    createdAt: Date.now(),
    answerText: null,
    answerUpdatedAt: null,
    ...overrides,
  };
}

describe('TvComponent', () => {
  let httpMock: HttpTestingController;

  function configure() {
    TestBed.configureTestingModule({
      imports: [TvComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  async function render(response: WallResponse) {
    const fixture = TestBed.createComponent(TvComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/wall').flush(response);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders the prompt banner from the wall response', async () => {
    configure();
    const fixture = await render({
      prompt: { id: 1, text: 'A pergunta do momento' },
      posts: [],
      removedIds: [],
      serverTime: 1,
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('A pergunta do momento');
  });

  it('renders a prompt containing a script tag as literal text, never as HTML (07 AC7)', async () => {
    configure();
    const payload = '<script>alert(1)</script>';
    const fixture = await render({
      prompt: { id: 1, text: payload },
      posts: [],
      removedIds: [],
      serverTime: 1,
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain(payload);
  });

  it('a changed prompt reaches the banner on the next poll (07 AC4)', async () => {
    vi.useFakeTimers();
    try {
      configure();
      const fixture = TestBed.createComponent(TvComponent);
      fixture.detectChanges();
      httpMock.expectOne('/api/wall').flush({
        prompt: { id: 1, text: 'Pergunta inicial' },
        posts: [],
        removedIds: [],
        serverTime: 1,
      });
      await fixture.whenStable();
      fixture.detectChanges();

      await vi.advanceTimersByTimeAsync(5000);
      httpMock
        .expectOne((r) => r.url === '/api/wall')
        .flush({
          prompt: { id: 2, text: 'Pergunta nova' },
          posts: [],
          removedIds: [],
          serverTime: 2,
        });
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Pergunta nova');
      expect(el.textContent).not.toContain('Pergunta inicial');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows no pinned slot when there are no pinned posts', async () => {
    configure();
    const fixture = await render({
      prompt: null,
      posts: [post({ id: 1 }), post({ id: 2 })],
      removedIds: [],
      serverTime: 1,
    });
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.tv-pinned .pinned-carousel'),
    ).toBeNull();
  });

  it('splits pinned and unpinned posts into the two carousels', async () => {
    configure();
    const fixture = await render({
      prompt: null,
      posts: [post({ id: 1, message: 'Fixado', pinned: true }), post({ id: 2, message: 'Normal' })],
      removedIds: [],
      serverTime: 1,
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.tv-pinned')!.textContent).toContain('Fixado');
    expect(el.querySelector('.tv-pinned')!.textContent).not.toContain('Normal');
    expect(el.querySelector('.tv-unpinned')!.textContent).toContain('Normal');
    expect(el.querySelector('.tv-unpinned')!.textContent).not.toContain('Fixado');
  });

  it('a post added mid-cycle (via poll) joins the pool immediately, never skipped', async () => {
    vi.useFakeTimers();
    try {
      configure();
      const fixture = TestBed.createComponent(TvComponent);
      fixture.detectChanges();
      httpMock
        .expectOne('/api/wall')
        .flush({ prompt: null, posts: [post({ id: 1 })], removedIds: [], serverTime: 1 });
      await fixture.whenStable();
      fixture.detectChanges();

      await vi.advanceTimersByTimeAsync(5000);
      httpMock
        .expectOne((r) => r.url === '/api/wall')
        .flush({
          prompt: null,
          posts: [post({ id: 99, message: 'Post novo' })],
          removedIds: [],
          serverTime: 2,
        });
      await fixture.whenStable();
      fixture.detectChanges();

      const tv = fixture.componentInstance;
      expect(tv.unpinnedPosts().some((p) => p.id === 99)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a removed post (via poll) disappears from the pool', async () => {
    vi.useFakeTimers();
    try {
      configure();
      const fixture = TestBed.createComponent(TvComponent);
      fixture.detectChanges();
      httpMock
        .expectOne('/api/wall')
        .flush({ prompt: null, posts: [post({ id: 1 })], removedIds: [], serverTime: 1 });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.componentInstance.unpinnedPosts().some((p) => p.id === 1)).toBe(true);

      await vi.advanceTimersByTimeAsync(5000);
      httpMock
        .expectOne((r) => r.url === '/api/wall')
        .flush({ prompt: null, posts: [], removedIds: [1], serverTime: 2 });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.unpinnedPosts().some((p) => p.id === 1)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('wires the pinned slot to page 1-at-a-time, non-interactive, on an 8s beat', async () => {
    configure();
    const fixture = await render({
      prompt: null,
      posts: [post({ id: 1, pinned: true }), post({ id: 2, pinned: true })],
      removedIds: [],
      serverTime: 1,
    });
    const carousel = fixture.debugElement
      .query(By.css('.tv-pinned'))
      .injector.get(PinnedCarouselComponent);
    expect(carousel.pageSize()).toBe(1);
    expect(carousel.intervalMs()).toBe(8000);
    expect(carousel.interactive()).toBe(false);
  });

  it('wires the unpinned row to page 3-at-a-time, non-interactive, on an 8s beat', async () => {
    configure();
    const fixture = await render({
      prompt: null,
      posts: [post({ id: 1 })],
      removedIds: [],
      serverTime: 1,
    });
    const carousel = fixture.debugElement
      .query(By.css('.tv-unpinned'))
      .injector.get(PinnedCarouselComponent);
    expect(carousel.pageSize()).toBe(3);
    expect(carousel.intervalMs()).toBe(8000);
    expect(carousel.interactive()).toBe(false);
  });

  it('has no button, link, or click-bound element anywhere on screen', async () => {
    configure();
    const fixture = await render({
      prompt: { id: 1, text: 'Pergunta' },
      posts: [
        post({ id: 1, message: 'Fixado', pinned: true }),
        post({ id: 2, message: 'Normal', answerText: 'Resposta' }),
      ],
      removedIds: [],
      serverTime: 1,
    });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('button').length).toBe(0);
    expect(el.querySelectorAll('a').length).toBe(0);
    expect(el.querySelectorAll('[href]').length).toBe(0);
  });

  it('renders a QR svg with at least one dark cell', async () => {
    configure();
    const fixture = await render({ prompt: null, posts: [], removedIds: [], serverTime: 1 });
    const el = fixture.nativeElement as HTMLElement;

    const svg = el.querySelector('.tv-qr__code');
    expect(svg).not.toBeNull();
    expect(svg!.querySelectorAll('rect').length).toBeGreaterThan(1);
  });

  it('shows the empty-wall invitation when there are no posts at all', async () => {
    configure();
    const fixture = await render({ prompt: null, posts: [], removedIds: [], serverTime: 1 });
    expect((fixture.nativeElement as HTMLElement).querySelector('.tv-empty')).not.toBeNull();
  });
});
