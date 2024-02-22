import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CustomerCreatePageRoutingModule } from './customer-create-routing.module';

import { CustomerCreatePage } from './customer-create.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    CustomerCreatePageRoutingModule,
    TranslateModule.forChild({ extend: true })
  ],
  declarations: [CustomerCreatePage]
})
export class CustomerCreatePageModule {}
