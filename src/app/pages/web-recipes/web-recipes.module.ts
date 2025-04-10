import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'
import { WebRecipesPage } from './web-recipes.page'
import { CoreModule } from 'src/app/core/core.module'

@NgModule({
  imports: [
    CommonModule,
    CoreModule,
    FormsModule,
    IonicModule,
    TranslateModule.forChild({ extend: true }),
    RouterModule.forChild([{
      path: '', component: WebRecipesPage
    }])
  ],
  declarations: [WebRecipesPage]
})
export class WebRecipesPageModule {}
