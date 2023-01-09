import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { CapitalizePipe } from './capitalize.pipe';
import { ProductPricePipe } from './product-price.pipe';
import { ReversePipe } from './reverse.pipe'

@NgModule({
  declarations: [
    CapitalizePipe,
    ProductPricePipe,
    ReversePipe
  ],
  exports: [
    CapitalizePipe,
    ProductPricePipe,
    ReversePipe
  ],
  imports: [
    CommonModule
  ]
})
export class PipesModule { }
