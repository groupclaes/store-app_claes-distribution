import { ChangeDetectionStrategy, Component } from '@angular/core'

import { registerLocaleData } from '@angular/common'
import localeFrBE from '@angular/common/locales/fr-BE'
import localeNlBE from '@angular/common/locales/nl-BE'
registerLocaleData(localeFrBE)
registerLocaleData(localeNlBE)

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  databaseLoaded = false
  selectedTheme: string
  constructor() { }
}
