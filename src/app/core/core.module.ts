import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { PipesModule } from './pipes/pipes.module'
import { RecipeBannerComponent } from './components/recipe-banner/recipe-banner.component'
import { IonicModule } from '@ionic/angular'
import { OptionalInputModalComponent } from './components/optional-input-modal/optional-input-modal.component'
import { FormsModule } from '@angular/forms'
import { OfflineFooterComponent } from './components/offline-footer/offline-footer.component'

@NgModule({
  declarations: [
    RecipeBannerComponent,
    OptionalInputModalComponent,
    OfflineFooterComponent
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
    OptionalInputModalComponent,
    OfflineFooterComponent
  ]
})
export class CoreModule { }
