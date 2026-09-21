import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface MaterialLink {
  title: string;
  subtitle: string;
  href: string;
}

const MATERIALS: readonly MaterialLink[] = [
  {
    title: 'Dia 1 · Claude Code & Agentic Engineering',
    subtitle: 'Slides da sessão',
    href: '/course/day1-deck.html',
  },
  {
    title: 'Guia 1 · Fundações',
    subtitle: 'Guia de preparação',
    href: '/course/guide-1-foundations.html',
  },
  {
    title: 'Dia 2 · O Loop: intent → spec → plan → execute → ship',
    subtitle: 'Slides da sessão',
    href: '/course/day2-deck.html',
  },
  {
    title: 'Guia 2 · O Loop',
    subtitle: 'Escrever os cinco comandos e correr uma feature por eles',
    href: '/course/guide-2-the-loop.html',
  },
];

/** Static list of course materials — plain files under public/course/, opened in a new tab. */
@Component({
  selector: 'app-materials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './materials.html',
  styleUrl: './materials.scss',
})
export class MaterialsComponent {
  readonly materials = MATERIALS;
}
