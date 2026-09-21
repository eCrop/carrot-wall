import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MaterialsComponent } from './materials';

describe('MaterialsComponent', () => {
  it('lists every material as an external link opening in a new tab', async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialsComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(MaterialsComponent);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll(
      '.list a',
    ) as NodeListOf<HTMLAnchorElement>;

    expect(links.length).toBe(4);
    for (const link of Array.from(links)) {
      expect(link.getAttribute('href')).toMatch(/^\/course\//);
      expect(link.getAttribute('target')).toBe('_blank');
    }
  });
});
