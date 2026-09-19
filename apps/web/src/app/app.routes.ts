import { Routes } from '@angular/router';

import { PostComponent } from './post/post';
import { WallComponent } from './wall/wall';

export const routes: Routes = [
  { path: '', component: WallComponent },
  { path: 'post', component: PostComponent },
];
