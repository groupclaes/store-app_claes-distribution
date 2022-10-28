import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'
import { RecipesPage } from './recipes.page'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule.forChild(),
    RouterModule.forChild([{
      path: '', component: RecipesPage
    }])
  ],
  declarations: [RecipesPage]
})
export class RecipesPageModule {}
