import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { ProductDetailPage } from './product-detail.page'
import { TranslateModule } from '@ngx-translate/core'
import { RouterModule } from '@angular/router'
import { CoreModule } from 'src/app/core/core.module'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CoreModule,
    TranslateModule.forChild(),
    RouterModule.forChild([{
      path: '', component: ProductDetailPage
    }])
  ],
  declarations: [ProductDetailPage]
})
export class ProductDetailPageModule {}
