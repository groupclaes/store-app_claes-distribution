import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'

import { CustomersPageRoutingModule } from './customers-routing.module'
import { ScrollingModule as ExperimentalScrollingModule } from '@angular/cdk-experimental/scrolling'
import { ScrollingModule } from '@angular/cdk/scrolling'
import { CustomersPage } from './customers.page'
import { TranslateModule } from '@ngx-translate/core'
import { CoreModule } from 'src/app/core/core.module'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CoreModule,
    CustomersPageRoutingModule,
    ScrollingModule,
    ExperimentalScrollingModule,
    TranslateModule.forChild({ extend: true })
  ],
  declarations: [CustomersPage]
})
export class CustomersPageModule {
}
