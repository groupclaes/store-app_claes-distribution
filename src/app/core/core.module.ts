import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { PipesModule } from './pipes/pipes.module'
import { RecipeBannerComponent } from './components/recipe-banner/recipe-banner.component'

@NgModule({
  declarations: [
    RecipeBannerComponent
  ],
  imports: [
    CommonModule,
    PipesModule
  ],
  exports: [
    PipesModule,
    RecipeBannerComponent
  ]
})
export class CoreModule { }
