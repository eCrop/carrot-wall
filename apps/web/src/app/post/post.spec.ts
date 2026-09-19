import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { PostComponent } from './post';

describe('PostComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('defaults the selected type to livre', () => {
    const fixture = TestBed.createComponent(PostComponent);
    const component = fixture.componentInstance;
    expect(component.type()).toBe('livre');
  });

  it('switches the selected type on chip click', () => {
    const fixture = TestBed.createComponent(PostComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const buttons = fixture.nativeElement.querySelectorAll(
      'button.chip',
    ) as NodeListOf<HTMLButtonElement>;
    const perguntaButton = Array.from(buttons).find((b) => b.textContent?.includes('Pergunta'));
    perguntaButton?.click();

    expect(component.type()).toBe('pergunta');
  });

  it('shows the remaining character count and blocks over 280 via maxlength', () => {
    const fixture = TestBed.createComponent(PostComponent);
    const component = fixture.componentInstance;
    component.message.set('a'.repeat(10));
    fixture.detectChanges();

    expect(component.remaining()).toBe(270);

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(280);
  });

  it('shows a PT error and makes no HTTP call when the message is empty', () => {
    const fixture = TestBed.createComponent(PostComponent);
    const component = fixture.componentInstance;
    component.message.set('   ');

    component.submit();
    fixture.detectChanges();

    httpMock.expectNone('/api/posts');
    expect(component.error()).toContain('Escreve qualquer coisa');
  });

  it('shows the PT rate-limit message on a 429 response', () => {
    const fixture = TestBed.createComponent(PostComponent);
    const component = fixture.componentInstance;
    component.message.set('Olá pessoal');

    component.submit();
    const req = httpMock.expectOne('/api/posts');
    req.flush({ message: 'rate limited' }, { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();

    expect(component.error()).toContain('Calma aí');
    expect(component.submitting()).toBe(false);
  });

  it('navigates to / with the new post id highlighted on success', () => {
    const fixture = TestBed.createComponent(PostComponent);
    const component = fixture.componentInstance;
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.message.set('Olá pessoal');

    component.submit();
    const req = httpMock.expectOne('/api/posts');
    expect(req.request.headers.has('X-Client-Token')).toBe(true);
    req.flush({ id: 42 });

    expect(navigateSpy).toHaveBeenCalledWith(['/'], { queryParams: { highlight: 42 } });
  });
});
