import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { WallComponent } from '../wall/wall';
import { WALL_INCLUDE_HIDDEN, WallService } from '../wall/wall.service';
import { AdminAuthService } from './admin-auth.service';

const WRONG_PIN_ERROR = 'PIN incorreto. Tenta outra vez.';

/**
 * The gate and the admin wall are two states of one component, not two routes — there is no
 * navigation between "locked" and "in", just a signal flip. `WallService` is re-provided here
 * (alongside `WALL_INCLUDE_HIDDEN: true`) so `<app-wall>` renders hidden posts too, without
 * touching the app-wide singleton `/` uses.
 */
@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, WallComponent],
  providers: [{ provide: WALL_INCLUDE_HIDDEN, useValue: true }, WallService],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class AdminComponent {
  private readonly auth = inject(AdminAuthService);

  readonly checking = signal(true);
  readonly loggedIn = signal(false);
  readonly pin = signal('');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.auth.checkSession().then((valid) => {
      this.loggedIn.set(valid);
      this.checking.set(false);
    });
  }

  submit(): void {
    this.error.set(null);
    this.submitting.set(true);

    void this.auth.login(this.pin()).then((success) => {
      this.submitting.set(false);
      if (success) {
        this.loggedIn.set(true);
      } else {
        this.error.set(WRONG_PIN_ERROR);
      }
    });
  }
}
