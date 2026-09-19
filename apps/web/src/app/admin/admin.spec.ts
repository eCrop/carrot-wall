import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AdminComponent } from './admin';

/**
 * `fixture.whenStable()` only waits for Angular's own tracked pending tasks (the HTTP request
 * itself); it does not wait for our own `.then()` on top of it (`AdminAuthService` resolves the
 * promise, then `AdminComponent`'s own `.then()` sets state). One extra macrotask tick lets
 * that drain before we assert on the result.
 */
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

describe('AdminComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the passcode form when there is no valid session', async () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();

    httpMock
      .expectOne('/api/admin/session')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle(fixture);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('form')).not.toBeNull();
    expect(el.querySelector('app-wall')).toBeNull();
  });

  it('shows a PT error and stays on the form when the PIN is wrong', async () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
    httpMock
      .expectOne('/api/admin/session')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle(fixture);

    const component = fixture.componentInstance;
    component.pin.set('1234');
    component.submit();
    httpMock.expectOne('/api/admin/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle(fixture);

    expect(component.error()).toContain('PIN incorreto');
    expect(component.loggedIn()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).not.toBeNull();
  });

  it('renders the wall instead of the form once a valid session is confirmed', async () => {
    const fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/admin/session').flush(null);
    await settle(fixture);

    // <app-wall> loads its own first page through its own WallService instance.
    httpMock
      .expectOne('/api/wall?includeHidden=true')
      .flush({ prompt: null, posts: [], removedIds: [], serverTime: 1 });
    await settle(fixture);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-wall')).not.toBeNull();
    expect(el.querySelector('form')).toBeNull();
  });
});
