import { TranslateModule } from '@ngx-translate/core'
import { RouterModule } from '@angular/router'
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { SettingsPage } from './settings.page'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule.forChild(),
    RouterModule.forChild([{
      path: '', component: SettingsPage
    }])
  ],
  declarations: [SettingsPage]
})
export class SettingsPageModule {}
