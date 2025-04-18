import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { DocumentViewerPage } from './document-viewer.page'
import { TranslateModule } from '@ngx-translate/core'
import { RouterModule } from '@angular/router'
import { CoreModule } from 'src/app/core/core.module'
import { PdfViewerModule } from 'ng2-pdf-viewer'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CoreModule,
    TranslateModule.forChild({ extend: true }),
    RouterModule.forChild([{
      path: '', component: DocumentViewerPage
    }]),
    PdfViewerModule
  ],
  declarations: [DocumentViewerPage]
})
export class DocumentViewerPageModule {}
