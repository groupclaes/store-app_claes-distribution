import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { CapitalizePipe } from './capitalize.pipe'
import { ProductPricePipe } from './product-price.pipe'
import { ReversePipe } from './reverse.pipe'
import { SecurePipe } from './secure.pipe'

@NgModule({
  declarations: [
    CapitalizePipe,
    ProductPricePipe,
    ReversePipe,
    SecurePipe
  ],
  exports: [
    CapitalizePipe,
    ProductPricePipe,
    ReversePipe,
    SecurePipe
  ],
  imports: [
    CommonModule
  ]
})
export class PipesModule { }
