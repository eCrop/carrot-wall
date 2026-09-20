import { Routes } from '@angular/router';

import { AdminComponent } from './admin/admin';
import { MaterialsComponent } from './materials/materials';
import { PostComponent } from './post/post';
import { TvComponent } from './tv/tv';
import { WallComponent } from './wall/wall';

export const routes: Routes = [
  { path: '', component: WallComponent },
  { path: 'post', component: PostComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'tv', component: TvComponent },
  { path: 'materials', component: MaterialsComponent },
];
