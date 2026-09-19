import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { PinnedCarouselComponent } from './pinned-carousel';
import { Post } from './wall.models';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    name: 'Rita',
    message: 'Olá mundo',
    type: 'livre',
    pinned: true,
    hidden: false,
    upvotes: 0,
    createdAt: Date.now(),
    answerText: null,
    answerUpdatedAt: null,
    ...overrides,
  };
}

function posts(count: number): Post[] {
  return Array.from({ length: count }, (_, i) => post({ id: i + 1, message: `Post ${i + 1}` }));
}

function render(input: Post[]) {
  const fixture = TestBed.createComponent(PinnedCarouselComponent);
  fixture.componentRef.setInput('posts', input);
  fixture.detectChanges();
  return fixture;
}

describe('PinnedCarouselComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PinnedCarouselComponent] });
  });

  it('renders nothing when there are no pinned posts', () => {
    const fixture = render([]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.pinned-carousel')).toBeNull();
  });

  it('shows the first page of up to 3 posts when given more', () => {
    const fixture = render(posts(5));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('app-post-card').length).toBe(3);
    expect(el.textContent).toContain('Post 1');
    expect(el.textContent).toContain('Post 3');
    expect(el.textContent).not.toContain('Post 4');
  });

  it('shows no dots at all with 3 or fewer pinned posts (a single page)', () => {
    const fixture = render(posts(3));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pinned-carousel__dot').length).toBe(0);
  });

  it('auto-advances to the next page every 6s, wrapping back to the first', () => {
    vi.useFakeTimers();
    try {
      const fixture = render(posts(5));
      const el = fixture.nativeElement as HTMLElement;

      vi.advanceTimersByTime(6000);
      fixture.detectChanges();
      expect(el.textContent).toContain('Post 4');
      expect(el.textContent).not.toContain('Post 1');

      vi.advanceTimersByTime(6000);
      fixture.detectChanges();
      expect(el.textContent).toContain('Post 1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses auto-advance on mouseenter and resumes on mouseleave', () => {
    vi.useFakeTimers();
    try {
      const fixture = render(posts(5));
      const el = fixture.nativeElement as HTMLElement;
      const strip = el.querySelector('.pinned-carousel') as HTMLElement;

      strip.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(6000);
      fixture.detectChanges();
      expect(el.textContent).toContain('Post 1');

      strip.dispatchEvent(new Event('mouseleave'));
      vi.advanceTimersByTime(6000);
      fixture.detectChanges();
      expect(el.textContent).toContain('Post 4');
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses on focusin and resumes on focusout', () => {
    vi.useFakeTimers();
    try {
      const fixture = render(posts(5));
      const el = fixture.nativeElement as HTMLElement;
      const strip = el.querySelector('.pinned-carousel') as HTMLElement;

      strip.dispatchEvent(new Event('focusin'));
      vi.advanceTimersByTime(6000);
      fixture.detectChanges();
      expect(el.textContent).toContain('Post 1');

      strip.dispatchEvent(new Event('focusout'));
      vi.advanceTimersByTime(6000);
      fixture.detectChanges();
      expect(el.textContent).toContain('Post 4');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a dot click jumps directly to that page', () => {
    const fixture = render(posts(5));
    const el = fixture.nativeElement as HTMLElement;

    const dots = el.querySelectorAll('.pinned-carousel__dot');
    expect(dots.length).toBe(2);
    (dots[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Post 4');
  });

  it('clamps back onto a valid page when the input shrinks below the current page index', () => {
    const fixture = render(posts(5));
    fixture.componentInstance.goTo(1);
    fixture.detectChanges();
    expect(fixture.componentInstance.currentPage()).toBe(1);

    fixture.componentRef.setInput('posts', posts(2));
    fixture.detectChanges();

    expect(fixture.componentInstance.currentPage()).toBe(0);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Post 1');
  });

  it('never auto-advances when prefers-reduced-motion is set', () => {
    const matchMediaSpy = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal('matchMedia', matchMediaSpy);
    vi.useFakeTimers();
    try {
      const fixture = render(posts(5));
      const el = fixture.nativeElement as HTMLElement;

      vi.advanceTimersByTime(30000);
      fixture.detectChanges();

      expect(el.textContent).toContain('Post 1');
      expect(el.textContent).not.toContain('Post 4');
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
