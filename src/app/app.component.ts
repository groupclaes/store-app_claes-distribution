import { SettingsService } from './core/settings.service'
import { environment } from './../environments/environment.prod'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core'

import { registerLocaleData } from '@angular/common'
import localeFrBE from '@angular/common/locales/fr-BE'
import localeNlBE from '@angular/common/locales/nl-BE'
import { Config, Platform } from '@ionic/angular'
import { LoggingProvider } from './@shared/logging/log.service'
import { TranslateService } from '@ngx-translate/core'
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
  selectedTheme: string = 'light-theme'

  constructor(
    platform: Platform,
    logger: LoggingProvider,
    settings: SettingsService,
    private translate: TranslateService,
    // private config: Config,
    private ref: ChangeDetectorRef
  ) {
    logger.log('MyApp.constructor() -- started.')
    platform.ready().then(() => {
      logger.log('MyApp.constructor() -- Platform is ready')
      settings.DisplayTheme.subscribe((selectedTheme: string) => {
        switch (selectedTheme) {
          case 'dark-theme':
            window.document.body.classList.remove('light-theme')
            window.document.body.classList.add('dark-theme')
            break

          default:
            window.document.body.classList.remove('dark-theme')
            window.document.body.classList.add('light-theme')
            break
        }

        this.ref.markForCheck()
      })
    })
    this.initTranslate()
  }

  async initTranslate() {
    this.translate.setDefaultLang(environment.default_language)
    const browserLang = this.translate.getBrowserCultureLang()

    this.translate.addLangs(environment.supported_languages)

    if (browserLang && this.translate.langs.some(e => e === browserLang)) {
      this.translate.use(browserLang)
    } else {
      this.translate.use(environment.default_language)
    }
  }

  get culture() {
    return this.translate.currentLang
  }
}
