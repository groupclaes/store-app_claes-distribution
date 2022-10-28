import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { DepartmentDetailPage } from './department-detail.page'
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
      path: '', component: DepartmentDetailPage
    }])
  ],
  declarations: [DepartmentDetailPage]
})
export class DepartmentDetailPageModule {}
