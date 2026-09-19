import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Post } from './wall.models';
import { PostCardComponent } from './post-card';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    name: 'Rita',
    message: 'Olá mundo',
    type: 'livre',
    pinned: false,
    hidden: false,
    upvotes: 3,
    createdAt: Date.now() - 5 * 60_000,
    answerText: null,
    answerUpdatedAt: null,
    ...overrides,
  };
}

async function render(input: Post, admin = false) {
  const fixture = TestBed.createComponent(PostCardComponent);
  fixture.componentRef.setInput('post', input);
  fixture.componentRef.setInput('admin', admin);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('PostCardComponent', () => {
  beforeEach(() => {
    // AnswerEditorComponent (rendered when admin=true) injects HttpClient — provided here so
    // DI resolves even though these tests never trigger a request through it; interaction
    // with the editor itself is answer-editor.spec.ts's job, not this file's.
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('renders the message, author, type and upvote count', async () => {
    const el = await render(post({ name: 'Rita', message: 'Olá mundo', upvotes: 7 }));
    expect(el.textContent).toContain('Olá mundo');
    expect(el.textContent).toContain('Rita');
    expect(el.textContent).toContain('7');
  });

  it('shows "Anónimo" when the post has no name', async () => {
    const el = await render(post({ name: null }));
    expect(el.textContent).toContain('Anónimo');
  });

  it('shows the pin marker only when pinned', async () => {
    const pinned = await render(post({ pinned: true }));
    expect(pinned.querySelector('.post-card__pin')).not.toBeNull();

    const unpinned = await render(post({ pinned: false }));
    expect(unpinned.querySelector('.post-card__pin')).toBeNull();
  });

  it('shows the answer block only when there is an answer', async () => {
    const answered = await render(post({ answerText: 'Sim.' }));
    expect(answered.textContent).toContain('Sim.');

    const unanswered = await render(post({ answerText: null }));
    expect(unanswered.querySelector('.post-card__answer')).toBeNull();
  });

  it('renders a message containing a script tag as literal text, never as HTML (spec §7.12)', async () => {
    const payload = '<script>alert(1)</script>';
    const el = await render(post({ message: payload }));

    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain(payload);
  });

  it('renders an answer containing a script tag as literal text, never as HTML (spec §7.12)', async () => {
    const payload = '<script>alert(1)</script>';
    const el = await render(post({ answerText: payload }));

    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain(payload);
  });

  it('shows the admin answer editor only when admin is true', async () => {
    const publicCard = await render(post());
    expect(publicCard.querySelector('app-answer-editor')).toBeNull();

    const adminCard = await render(post(), true);
    expect(adminCard.querySelector('app-answer-editor')).not.toBeNull();
    expect(adminCard.textContent).toContain('Responder');
  });

  it('shows the admin moderation controls only when admin is true', async () => {
    const publicCard = await render(post());
    expect(publicCard.querySelector('app-moderation-controls')).toBeNull();

    const adminCard = await render(post(), true);
    expect(adminCard.querySelector('app-moderation-controls')).not.toBeNull();
  });

  it('shows the "Oculto" marker and dims the card only for a hidden post in admin mode', async () => {
    const adminHidden = await render(post({ hidden: true }), true);
    expect(adminHidden.textContent).toContain('Oculto');
    expect(adminHidden.querySelector('.post-card--hidden')).not.toBeNull();

    const adminVisible = await render(post({ hidden: false }), true);
    expect(adminVisible.textContent).not.toContain('Oculto');
    expect(adminVisible.querySelector('.post-card--hidden')).toBeNull();

    // A hidden post never reaches a non-admin card in practice (it's excluded from the public
    // response entirely), but the marker still must not render if it somehow did.
    const publicHidden = await render(post({ hidden: true }), false);
    expect(publicHidden.textContent).not.toContain('Oculto');
  });

  describe('answer timestamp', () => {
    // Fixed "now" so the same-day/earlier-day boundary is deterministic rather than depending
    // on when the test suite happens to run. Mocks Date.now() only (not vi.useFakeTimers, which
    // also stubs setTimeout — and TestBed's whenStable() relies on real timers to resolve).
    const NOW = new Date('2026-09-19T14:32:00');

    beforeEach(() => {
      vi.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('shows a relative time for an answer under 1h old', async () => {
      const answeredAt = NOW.getTime() - 45 * 60_000;
      const el = await render(post({ answerText: 'Sim.', answerUpdatedAt: answeredAt }));

      const label = el.querySelector('.post-card__answer-label')!.textContent!;
      expect(label).toContain('há 45 minutos');
    });

    it('shows HH:mm for an answer over 1h old on the same day', async () => {
      const answeredAt = new Date('2026-09-19T10:05:00').getTime();
      const el = await render(post({ answerText: 'Sim.', answerUpdatedAt: answeredAt }));

      const expectedTime = new Intl.DateTimeFormat('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(answeredAt));
      const label = el.querySelector('.post-card__answer-label')!.textContent!;
      expect(label).toContain(expectedTime);
    });

    it('shows the date and time for an answer from an earlier day', async () => {
      const answeredAt = new Date('2026-09-17T14:32:00').getTime();
      const el = await render(post({ answerText: 'Sim.', answerUpdatedAt: answeredAt }));

      const expectedDate = new Intl.DateTimeFormat('pt-PT', {
        day: 'numeric',
        month: 'short',
      }).format(new Date(answeredAt));
      const expectedTime = new Intl.DateTimeFormat('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(answeredAt));
      const label = el.querySelector('.post-card__answer-label')!.textContent!;
      expect(label).toContain(expectedDate);
      expect(label).toContain(expectedTime);
    });
  });
});
