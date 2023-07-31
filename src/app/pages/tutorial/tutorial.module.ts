import { TranslateModule } from '@ngx-translate/core'
import { RouterModule } from '@angular/router'
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'
import { TutorialPage } from './tutorial.page'

import { register } from 'swiper/element/bundle';

register();

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule.forChild(),
    RouterModule.forChild([{
      path: '', component: TutorialPage
    }]),
  ],
  schemas: [ CUSTOM_ELEMENTS_SCHEMA ],
  declarations: [TutorialPage]
})
export class TutorialPageModule { }
