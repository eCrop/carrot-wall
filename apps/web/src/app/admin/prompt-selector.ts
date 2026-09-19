import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { WallService } from '../wall/wall.service';
import { AdminPromptService, PromptPreset } from './admin-prompt.service';

const MAX_PROMPT_LENGTH = 200;

/**
 * The "Mudar pergunta" control on `/admin`'s prompt banner — collapsed by default, same
 * toggle/expand/cancel shape as AnswerEditorComponent. Presets are fetched once, on first
 * expand, rather than eagerly: the selector may never be opened in a given session.
 */
@Component({
  selector: 'app-prompt-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './prompt-selector.html',
  styleUrl: './prompt-selector.scss',
})
export class PromptSelectorComponent {
  private readonly adminPrompt = inject(AdminPromptService);
  private readonly wallService = inject(WallService);

  /** The currently active prompt's text, or `null` — used only to highlight a matching preset;
   * free text (or no active prompt yet) highlights nothing. */
  readonly activeText = input<string | null>(null);
  readonly maxPromptLength = MAX_PROMPT_LENGTH;

  readonly expanded = signal(false);
  readonly presets = signal<PromptPreset[]>([]);
  readonly text = signal('');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly remaining = computed(() => this.maxPromptLength - this.text().length);
  readonly canSubmitText = computed(
    () => !this.submitting() && this.text().trim().length > 0 && this.remaining() >= 0,
  );

  toggle(): void {
    if (this.expanded()) {
      this.collapse();
      return;
    }

    this.error.set(null);
    this.expanded.set(true);
    if (this.presets().length === 0) {
      void this.adminPrompt.getPresets().then(
        (presets) => this.presets.set(presets),
        () => this.error.set('Não foi possível carregar as sugestões.'),
      );
    }
  }

  cancel(): void {
    this.collapse();
  }

  selectPreset(preset: PromptPreset): void {
    this.activate({ presetId: preset.id });
  }

  submitText(): void {
    const trimmed = this.text().trim();
    if (trimmed.length === 0 || trimmed.length > this.maxPromptLength) {
      return;
    }
    this.activate({ text: trimmed });
  }

  private activate(request: { presetId: number } | { text: string }): void {
    this.error.set(null);
    this.submitting.set(true);

    this.adminPrompt.activate(request).then(
      () => {
        this.submitting.set(false);
        this.collapse();
        void this.wallService.poll();
      },
      (err: unknown) => {
        this.submitting.set(false);
        this.error.set(err instanceof Error ? err.message : 'Não foi possível mudar a pergunta.');
      },
    );
  }

  private collapse(): void {
    this.expanded.set(false);
    this.text.set('');
    this.error.set(null);
  }
}
