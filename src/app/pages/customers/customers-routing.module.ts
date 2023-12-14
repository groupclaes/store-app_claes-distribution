import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CustomersPage } from './customers.page';

const routes: Routes = [
  {
    path: '',
    component: CustomersPage
  },
  {
    path: 'customer-info',
    loadChildren: () => import('./customer-info/customer-info.module').then( m => m.CustomerInfoPageModule)
  },
  {
    path: 'customer-create',
    loadChildren: () => import('./customer-create/customer-create.module').then( m => m.CustomerCreatePageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CustomersPageRoutingModule {}
