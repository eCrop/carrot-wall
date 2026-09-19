import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { WallResponse } from './wall.models';
import { WallComponent } from './wall';

describe('WallComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WallComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the empty state when the wall has no posts', async () => {
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
});
