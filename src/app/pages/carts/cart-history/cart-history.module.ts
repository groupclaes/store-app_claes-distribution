import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { CartHistoryPage } from './cart-history.page'
import { TranslateModule } from '@ngx-translate/core'
import { RouterModule } from '@angular/router'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule.forChild(),
    RouterModule.forChild([{
      path: '', component: CartHistoryPage
    }])
  ],
  declarations: [CartHistoryPage]
})
export class CartHistoryPageModule { }
