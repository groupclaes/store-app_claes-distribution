import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { WebRecipeDetailPage } from './web-recipe-detail.page'
import { TranslateModule } from '@ngx-translate/core'
import { RouterModule } from '@angular/router'
import { CoreModule } from 'src/app/core/core.module'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CoreModule,
    TranslateModule.forChild({ extend: true }),
    RouterModule.forChild([{
      path: '', component: WebRecipeDetailPage
    }])
  ],
  declarations: [WebRecipeDetailPage]
})
export class WebRecipeDetailPageModule {}
