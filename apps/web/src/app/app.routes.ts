import { Routes } from '@angular/router';

import { AdminComponent } from './admin/admin';
import { PostComponent } from './post/post';
import { WallComponent } from './wall/wall';

export const routes: Routes = [
  { path: '', component: WallComponent },
  { path: 'post', component: PostComponent },
  { path: 'admin', component: AdminComponent },
];
