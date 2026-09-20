import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MaterialsComponent } from './materials';

describe('MaterialsComponent', () => {
  it('lists both materials as external links opening in a new tab', async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialsComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(MaterialsComponent);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll(
      '.list a',
    ) as NodeListOf<HTMLAnchorElement>;

    expect(links.length).toBe(2);
    for (const link of Array.from(links)) {
      expect(link.getAttribute('href')).toMatch(/^\/course\//);
      expect(link.getAttribute('target')).toBe('_blank');
    }
  });
});
