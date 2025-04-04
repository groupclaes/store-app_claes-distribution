import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'
import { DatasheetsPage } from './datasheets-page.component'
import { CoreModule } from 'src/app/core/core.module'
import { ScrollingModule as ExperimentalScrollingModule } from '@angular/cdk-experimental/scrolling'
import { ScrollingModule } from '@angular/cdk/scrolling'

@NgModule({
  imports: [
    CommonModule,
    CoreModule,
    FormsModule,
    IonicModule,
    ExperimentalScrollingModule,
    ScrollingModule,
    TranslateModule.forChild({ extend: true }),
    RouterModule.forChild([{
      path: '', component: DatasheetsPage
    }])
  ],
  declarations: [DatasheetsPage]
})
export class DatashetsPageModule {
}
