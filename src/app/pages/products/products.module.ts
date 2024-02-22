import { NgModule } from '@angular/core'
import { CommonModule, DatePipe } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { ProductsPage } from './products.page'
import { TranslateModule } from '@ngx-translate/core'
import { RouterModule } from '@angular/router'
import { CoreModule } from 'src/app/core/core.module'
import { ScrollingModule } from '@angular/cdk/scrolling'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ScrollingModule,
    CoreModule,
    TranslateModule.forChild({ extend: true }),
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
