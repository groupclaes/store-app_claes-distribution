import { RouterModule } from '@angular/router'
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { IonicModule } from '@ionic/angular'
import { FormsModule } from '@angular/forms'
import { LeafletPage } from './leaflet.page'
import { PdfViewerModule } from 'ng2-pdf-viewer'
import { TranslateModule } from '@ngx-translate/core'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PdfViewerModule,
    TranslateModule.forChild(),
    RouterModule.forChild([{
      path: '', component: LeafletPage
    }])
  ],
  declarations: [LeafletPage]
})
export class LeafletPageModule {
}
