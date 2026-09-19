import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { vi } from 'vitest';

import { Post, WallResponse } from './wall.models';
import { WallComponent } from './wall';

function activatedRouteWithQueryParams(params: Record<string, string>): Partial<ActivatedRoute> {
  return { snapshot: { queryParamMap: convertToParamMap(params) } as ActivatedRoute['snapshot'] };
}

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

describe('WallComponent', () => {
  let httpMock: HttpTestingController;

  function configure(activatedRoute: Partial<ActivatedRoute> = activatedRouteWithQueryParams({})) {
    TestBed.configureTestingModule({
      imports: [WallComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: activatedRoute },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the empty state when the wall has no posts', async () => {
    configure();
    const fixture = TestBed.createComponent(WallComponent);
    fixture.detectChanges();

    const empty: WallResponse = { prompt: null, posts: [], removedIds: [], serverTime: 1 };
    httpMock.expectOne('/api/wall').flush(empty);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.wall-empty')).not.toBeNull();
    expect(el.querySelectorAll('app-post-card').length).toBe(0);
  });

  it('renders a card per post and the prompt banner', async () => {
    configure();
    const fixture = TestBed.createComponent(WallComponent);
    fixture.detectChanges();

    const response: WallResponse = {
      prompt: { id: 1, text: 'A pergunta do momento' },
      posts: [
        {
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
        },
      ],
      removedIds: [],
      serverTime: 1,
    };
    httpMock.expectOne('/api/wall').flush(response);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('A pergunta do momento');
    expect(el.querySelectorAll('app-post-card').length).toBe(1);
  });

  it('rings the card named by ?highlight= once it has loaded, then clears the param after 2s', async () => {
    vi.useFakeTimers();
    try {
      configure(activatedRouteWithQueryParams({ highlight: '7' }));
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      const fixture = TestBed.createComponent(WallComponent);
      fixture.detectChanges();

      const response: WallResponse = {
        prompt: null,
        posts: [
          {
            id: 7,
            name: null,
            message: 'Novo post',
            type: 'livre',
            pinned: false,
            hidden: false,
            upvotes: 0,
            createdAt: Date.now(),
            answerText: null,
            answerUpdatedAt: null,
          },
        ],
        removedIds: [],
        serverTime: 1,
      };
      httpMock.expectOne('/api/wall').flush(response);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.highlightedPostId()).toBe(7);
      expect(navigateSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: {}, replaceUrl: true }),
      );

      expect(fixture.nativeElement.querySelector('.post-card--highlighted')).not.toBeNull();

      vi.advanceTimersByTime(2000);
      fixture.detectChanges();
      expect(fixture.componentInstance.highlightedPostId()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('on the public wall, pinned posts render in the carousel and not in the grid', async () => {
    configure();
    const fixture = TestBed.createComponent(WallComponent);
    fixture.detectChanges();

    const response: WallResponse = {
      prompt: null,
      posts: [
        post({ id: 1, message: 'Fixado', pinned: true }),
        post({ id: 2, message: 'Normal', pinned: false }),
      ],
      removedIds: [],
      serverTime: 1,
    };
    httpMock.expectOne('/api/wall').flush(response);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const carousel = el.querySelector('app-pinned-carousel') as HTMLElement;
    expect(carousel).not.toBeNull();
    expect(carousel.textContent).toContain('Fixado');

    const grid = el.querySelector('.wall-grid') as HTMLElement;
    expect(grid.textContent).toContain('Normal');
    expect(grid.textContent).not.toContain('Fixado');
  });

  it('on the admin wall, every post renders in one grid and there is no carousel', async () => {
    configure();
    const fixture = TestBed.createComponent(WallComponent);
    fixture.componentRef.setInput('admin', true);
    fixture.detectChanges();

    const response: WallResponse = {
      prompt: null,
      posts: [
        post({ id: 1, message: 'Fixado', pinned: true }),
        post({ id: 2, message: 'Normal', pinned: false }),
      ],
      removedIds: [],
      serverTime: 1,
    };
    httpMock.expectOne('/api/wall').flush(response);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-pinned-carousel')).toBeNull();

    const grid = el.querySelector('.wall-grid') as HTMLElement;
    expect(grid.textContent).toContain('Fixado');
    expect(grid.textContent).toContain('Normal');
  });

  it('never highlights anything when there is no ?highlight= param', async () => {
    configure();
    const fixture = TestBed.createComponent(WallComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.highlightedPostId()).toBeNull();
    httpMock
      .expectOne('/api/wall')
      .flush({ prompt: null, posts: [], removedIds: [], serverTime: 1 });
  });
});
