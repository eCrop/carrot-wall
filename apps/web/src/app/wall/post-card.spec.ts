import { TestBed } from '@angular/core/testing';

import { Post } from './wall.models';
import { PostCardComponent } from './post-card';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    name: 'Rita',
    message: 'Olá mundo',
    type: 'livre',
    pinned: false,
    upvotes: 3,
    createdAt: Date.now() - 5 * 60_000,
    answerText: null,
    answerUpdatedAt: null,
    ...overrides,
  };
}

async function render(input: Post) {
  const fixture = TestBed.createComponent(PostCardComponent);
  fixture.componentRef.setInput('post', input);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('PostCardComponent', () => {
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
});
