import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Post } from '../wall/wall.models';
import { AnswerEditorComponent } from './answer-editor';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    name: 'Rita',
    message: 'Olá mundo',
    type: 'livre',
    pinned: false,
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
  fixture: ComponentFixture<AnswerEditorComponent>;
  el: HTMLElement;
} {
  const fixture = TestBed.createComponent(AnswerEditorComponent);
  fixture.componentRef.setInput('post', input);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('AnswerEditorComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AnswerEditorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows "Responder" when the post has no answer yet', () => {
    const { el } = render(post());
    expect(el.textContent).toContain('Responder');
    expect(el.textContent).not.toContain('Editar resposta');
  });

  it('shows "Editar resposta" when the post already has an answer', () => {
    const { el } = render(post({ answerText: 'Sim.' }));
    expect(el.textContent).toContain('Editar resposta');
  });

  it('expands into a textarea prefilled with the existing answer on click', () => {
    const { fixture, el } = render(post({ answerText: 'Resposta existente' }));

    (el.querySelector('.answer-editor__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    const textarea = el.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(fixture.componentInstance.text()).toBe('Resposta existente');
  });

  it('collapses back to the link without saving on Cancel', () => {
    const { fixture, el } = render(post());
    fixture.componentInstance.toggle();
    fixture.detectChanges();

    (el.querySelector('.answer-editor__cancel') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('textarea')).toBeNull();
    expect(el.textContent).toContain('Responder');
  });

  it('saving persists the trimmed answer, collapses the editor, and triggers a poll', async () => {
    const { fixture, el } = render(post({ id: 42 }));
    fixture.componentInstance.toggle();
    fixture.componentInstance.text.set('  Boa pergunta!  ');
    fixture.detectChanges();

    fixture.componentInstance.save();
    httpMock
      .expectOne((r) => r.method === 'PUT' && r.url === '/api/admin/posts/42/answer')
      .flush(null);
    await settle(fixture);

    // The save triggers WallService.poll() to pick up the change without waiting for the
    // next 5s interval tick.
    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === '/api/wall')
      .flush({
        prompt: null,
        posts: [],
        removedIds: [],
        serverTime: 1,
      });
    await settle(fixture);

    expect(el.querySelector('textarea')).toBeNull();
  });

  it('saving with an empty textarea sends a clearing request', async () => {
    const { fixture } = render(post({ id: 7, answerText: 'Uma resposta' }));
    fixture.componentInstance.toggle();
    fixture.componentInstance.text.set('');
    fixture.detectChanges();

    fixture.componentInstance.save();
    const req = httpMock.expectOne(
      (r) => r.method === 'PUT' && r.url === '/api/admin/posts/7/answer',
    );
    expect(req.request.body).toEqual({ answerText: '' });
    req.flush(null);
    await settle(fixture);

    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === '/api/wall')
      .flush({ prompt: null, posts: [], removedIds: [], serverTime: 1 });
    await settle(fixture);
  });

  it('blocks Save and shows a PT error for an answer over 1000 characters, firing no request', () => {
    const { fixture, el } = render(post());
    fixture.componentInstance.toggle();
    fixture.componentInstance.text.set('x'.repeat(1001));
    fixture.detectChanges();

    fixture.componentInstance.save();
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toContain('1000 caracteres');
    expect(el.querySelector('.answer-editor__error')).not.toBeNull();
    httpMock.expectNone((r) => r.url.startsWith('/api/admin/posts'));
  });
});
