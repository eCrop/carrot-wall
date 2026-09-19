import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromptSelectorComponent } from './prompt-selector';

const PRESETS = [
  { id: 1, text: 'A única coisa que quero desta semana é…' },
  { id: 2, text: 'Perguntas para o fim do dia' },
];

/** See admin.spec.ts for why this extra macrotask tick is needed: whenStable() doesn't wait
 * for a .then() layered on top of an HTTP call. */
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

function render(activeText: string | null = null): {
  fixture: ComponentFixture<PromptSelectorComponent>;
  el: HTMLElement;
} {
  const fixture = TestBed.createComponent(PromptSelectorComponent);
  fixture.componentRef.setInput('activeText', activeText);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('PromptSelectorComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PromptSelectorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the "Mudar pergunta" toggle collapsed by default', () => {
    const { el } = render();
    expect(el.textContent).toContain('Mudar pergunta');
    expect(el.querySelector('.prompt-selector__preset')).toBeNull();
  });

  it('fetches and renders the 5 presets on expand', async () => {
    const { fixture, el } = render();

    (el.querySelector('.prompt-selector__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    httpMock.expectOne('/api/admin/prompts/presets').flush(PRESETS);
    await settle(fixture);

    const buttons = el.querySelectorAll('.prompt-selector__preset');
    expect(buttons.length).toBe(2);
    expect(buttons[1].textContent).toContain('Perguntas para o fim do dia');
  });

  it('marks the preset matching activeText as selected', async () => {
    const { fixture, el } = render('Perguntas para o fim do dia');

    (el.querySelector('.prompt-selector__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne('/api/admin/prompts/presets').flush(PRESETS);
    await settle(fixture);

    const buttons = el.querySelectorAll('.prompt-selector__preset');
    expect(buttons[0].classList).not.toContain('prompt-selector__preset--active');
    expect(buttons[1].classList).toContain('prompt-selector__preset--active');
  });

  it('marks no preset as selected when activeText is free text, empty, or null', async () => {
    for (const activeText of ['Uma pergunta escrita na hora', '', null]) {
      const { fixture, el } = render(activeText);

      (el.querySelector('.prompt-selector__toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      httpMock.expectOne('/api/admin/prompts/presets').flush(PRESETS);
      await settle(fixture);

      const buttons = el.querySelectorAll('.prompt-selector__preset');
      buttons.forEach((button) =>
        expect(button.classList).not.toContain('prompt-selector__preset--active'),
      );
    }
  });

  it('clicking a preset activates it, collapses the panel, and triggers a poll', async () => {
    const { fixture, el } = render();
    (el.querySelector('.prompt-selector__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne('/api/admin/prompts/presets').flush(PRESETS);
    await settle(fixture);

    (el.querySelectorAll('.prompt-selector__preset')[1] as HTMLButtonElement).click();
    httpMock.expectOne((r) => r.method === 'POST' && r.url === '/api/admin/prompt').flush(null);
    await settle(fixture);

    // The activation triggers WallService.poll() to pick up the change without waiting for
    // the next 5s interval tick.
    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === '/api/wall')
      .flush({ prompt: null, posts: [], removedIds: [], serverTime: 1 });
    await settle(fixture);

    expect(el.querySelector('.prompt-selector__panel')).toBeNull();
  });

  it('submitting free text activates it with the trimmed value', async () => {
    const { fixture, el } = render();
    (el.querySelector('.prompt-selector__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne('/api/admin/prompts/presets').flush(PRESETS);
    await settle(fixture);

    fixture.componentInstance.text.set('  Pergunta nova  ');
    fixture.componentInstance.submitText();

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url === '/api/admin/prompt');
    expect(req.request.body).toEqual({ text: 'Pergunta nova' });
    req.flush(null);
    await settle(fixture);

    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === '/api/wall')
      .flush({ prompt: null, posts: [], removedIds: [], serverTime: 1 });
    await settle(fixture);
  });

  it('shows the PT error from a rejected activation without collapsing', async () => {
    const { fixture, el } = render();
    (el.querySelector('.prompt-selector__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne('/api/admin/prompts/presets').flush(PRESETS);
    await settle(fixture);

    fixture.componentInstance.text.set('Pergunta nova');
    fixture.componentInstance.submitText();

    httpMock
      .expectOne((r) => r.method === 'POST' && r.url === '/api/admin/prompt')
      .flush(
        { message: 'A pergunta tem de ter entre 1 e 200 caracteres.' },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle(fixture);

    expect(el.querySelector('.prompt-selector__error')?.textContent).toContain(
      'A pergunta tem de ter entre 1 e 200 caracteres.',
    );
    expect(el.querySelector('.prompt-selector__panel')).not.toBeNull();
  });
});
