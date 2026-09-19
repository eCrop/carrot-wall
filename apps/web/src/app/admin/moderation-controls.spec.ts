import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Post } from '../wall/wall.models';
import { ModerationControlsComponent } from './moderation-controls';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    name: 'Rita',
    message: 'Olá mundo',
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

/** See admin.spec.ts for why this extra macrotask tick is needed: whenStable() doesn't wait
 * for a .then() layered on top of an HTTP call. */
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

function render(input: Post): {
  fixture: ComponentFixture<ModerationControlsComponent>;
  el: HTMLElement;
} {
  const fixture = TestBed.createComponent(ModerationControlsComponent);
  fixture.componentRef.setInput('post', input);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const EMPTY_WALL = { prompt: null, posts: [], removedIds: [], serverTime: 1 };

describe('ModerationControlsComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModerationControlsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows "Fixar" for an unpinned post and "Desfixar" for a pinned one', () => {
    const unpinned = render(post({ pinned: false }));
    expect(unpinned.el.textContent).toContain('Fixar');
    expect(unpinned.el.textContent).not.toContain('Desfixar');

    const pinned = render(post({ pinned: true }));
    expect(pinned.el.textContent).toContain('Desfixar');
  });

  it('shows "Ocultar" for a visible post and "Reexibir" for a hidden one', () => {
    const visible = render(post({ hidden: false }));
    expect(visible.el.textContent).toContain('Ocultar');
    expect(visible.el.textContent).not.toContain('Reexibir');

    const hidden = render(post({ hidden: true }));
    expect(hidden.el.textContent).toContain('Reexibir');
  });

  it('clicking Fixar calls the pin endpoint and triggers a poll', async () => {
    const { fixture, el } = render(post({ id: 42, pinned: false }));

    (el.querySelector('.moderation-controls__button') as HTMLButtonElement).click();
    httpMock
      .expectOne((r) => r.method === 'POST' && r.url === '/api/admin/posts/42/pin')
      .flush(null);
    await settle(fixture);

    httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/wall').flush(EMPTY_WALL);
    await settle(fixture);
  });

  it('clicking Ocultar calls the hide endpoint and triggers a poll', async () => {
    const { fixture, el } = render(post({ id: 7, hidden: false }));
    const buttons = el.querySelectorAll('.moderation-controls__button');

    (buttons[1] as HTMLButtonElement).click();
    httpMock
      .expectOne((r) => r.method === 'POST' && r.url === '/api/admin/posts/7/hide')
      .flush(null);
    await settle(fixture);

    httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/wall').flush(EMPTY_WALL);
    await settle(fixture);
  });

  it('a second click while the first pin request is in flight fires no extra request', async () => {
    const { fixture, el } = render(post({ id: 5, pinned: false }));
    const button = el.querySelector('.moderation-controls__button') as HTMLButtonElement;

    button.click();
    button.click();
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.method === 'POST' && r.url === '/api/admin/posts/5/pin')
      .flush(null);
    await settle(fixture);

    httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/wall').flush(EMPTY_WALL);
    await settle(fixture);
  });
});
