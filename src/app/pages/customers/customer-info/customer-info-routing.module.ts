import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CustomerInfoPage } from './customer-info.page';

const routes: Routes = [
  {
    path: '',
    component: CustomerInfoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CustomerInfoPageRoutingModule {}
