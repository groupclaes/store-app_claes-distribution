import { TranslateModule } from '@ngx-translate/core'
import { RouterModule } from '@angular/router'
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { ReportsPage } from './reports.page'
import { CoreModule } from '../../core/core.module'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule.forChild({ extend: true }),
    RouterModule.forChild([{
      path: '', component: ReportsPage
    }]),
    CoreModule
  ],
  declarations: [ReportsPage]
})
export class ReportsPageModule {}
