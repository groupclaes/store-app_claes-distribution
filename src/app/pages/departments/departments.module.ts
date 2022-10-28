import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { DepartmentsPage } from './departments.page'
import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { CoreModule } from 'src/app/core/core.module'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CoreModule,
    TranslateModule.forChild(),
    RouterModule.forChild([{
      path: '', component: DepartmentsPage
    }])
  ],
  declarations: [DepartmentsPage]
})
export class DepartmentsPageModule {}
