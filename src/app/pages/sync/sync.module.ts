import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { SyncPage } from './sync.page'
import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule.forChild(),
    RouterModule.forChild([{
      path: '', component: SyncPage
    }])
  ],
  declarations: [SyncPage]
})
export class SyncPageModule { }
