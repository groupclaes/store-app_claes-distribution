import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { PipesModule } from './pipes/pipes.module'
import { RecipeBannerComponent } from './components/recipe-banner/recipe-banner.component'
import { IonicModule } from '@ionic/angular'
import { OptionalInputModalComponent } from './components/optional-input-modal/optional-input-modal.component'
import { FormsModule } from '@angular/forms'

@NgModule({
  declarations: [
    RecipeBannerComponent,
    OptionalInputModalComponent
  ],
  imports: [
    CommonModule,
    PipesModule,
    IonicModule,
    FormsModule
  ],
  exports: [
    PipesModule,
    RecipeBannerComponent,
    OptionalInputModalComponent
  ]
})
export class CoreModule { }
