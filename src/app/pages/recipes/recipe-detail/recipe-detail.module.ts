import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { RecipeDetailPage } from './recipe-detail.page'
import { TranslateModule } from '@ngx-translate/core'
import { RouterModule } from '@angular/router'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule.forChild(),
    RouterModule.forChild([{
      path: '', component: RecipeDetailPage
    }])
  ],
  declarations: [RecipeDetailPage]
})
export class RecipeDetailPageModule {}
