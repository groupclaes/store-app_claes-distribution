import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { NewsPage } from './news.page'
import { TranslateModule } from '@ngx-translate/core'
import { RouterModule } from '@angular/router'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule.forChild(),
    RouterModule.forChild([{
      path: '', component: NewsPage
    }])
  ],
  declarations: [NewsPage]
})
export class NewsPageModule {}
