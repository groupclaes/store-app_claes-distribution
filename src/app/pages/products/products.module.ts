import { NgModule } from '@angular/core'
import { CommonModule, DatePipe } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { ProductsPage } from './products.page'
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
      path: '',
      component: ProductsPage
    }])
  ],
  providers: [
    DatePipe
  ],
  declarations: [ProductsPage]
})
export class ProductsPageModule { }
