import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { SyncPage } from './sync.page'
import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { CoreModule } from 'src/app/core/core.module'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CoreModule,
    TranslateModule.forChild({ extend: true }),
    RouterModule.forChild([{
      path: '', component: SyncPage
    }])
  ],
  declarations: [SyncPage]
})
export class SyncPageModule { }
