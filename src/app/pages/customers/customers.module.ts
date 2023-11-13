import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CustomersPageRoutingModule } from './customers-routing.module';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CustomersPage } from './customers.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CustomersPageRoutingModule,
    ScrollingModule,
    TranslateModule.forChild()
  ],
  declarations: [CustomersPage]
})
export class CustomersPageModule {}
