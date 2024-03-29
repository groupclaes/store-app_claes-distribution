import { UserService } from './core/user.service'
import { SettingsService } from './core/settings.service'
import { environment } from './../environments/environment.prod'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core'

import { registerLocaleData } from '@angular/common'
import localeFrBE from '@angular/common/locales/fr-BE'
import localeNlBE from '@angular/common/locales/nl-BE'
import { IonMenu, NavController, Platform } from '@ionic/angular'
import { LoggingProvider } from './@shared/logging/log.service'
import { TranslateService } from '@ngx-translate/core'
import { StorageProvider } from './core/storage-provider.service'
import { CartService } from './core/cart.service'
registerLocaleData(localeFrBE)
registerLocaleData(localeNlBE)

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  @ViewChild('menu') menu: IonMenu
  databaseLoaded = false
  selectedTheme: string = 'light-theme'

  constructor(
    platform: Platform,
    logger: LoggingProvider,
    settings: SettingsService,
    private translate: TranslateService,
    private storage: StorageProvider,
    private navCtrl: NavController,
    private ref: ChangeDetectorRef,
    private user: UserService,
    private cart: CartService
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

      const tutorialCompleted = localStorage.getItem('tutorialCompleted')
      if (tutorialCompleted) {
        this.navCtrl.navigateRoot('/account/login')
      } else {
        this.navCtrl.navigateRoot('/tutorial')
      }
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

  async open(componentName: string) {
    if (componentName === '/account/login') {
      this.user.logout()
    } else if (componentName === '/tutorial') {
      localStorage.removeItem('tutorialCompleted')
    }
    if (await this.navCtrl.navigateRoot(componentName)) {
      await this.menu.close()
    }
  }

  openLeaflet(): void {
    // this.statistics.leafletView(this.user.userinfo.userId)
    window.open(`https://pcm.groupclaes.be/v3/content/dis/website/month-leaflet/100/${this.culture.split('-')[0]}`, '_system', 'location=yes')
  }

  get menuItemsActive(): boolean {
    if (this.user && (!this.user.activeUser && this.user.userinfo && this.user.multiUser)) {
      return false
    }
    return true
  }

  get isAgent(): boolean {
    return this.user && this.user.hasAgentAccess
  }

  get hasCustomers(): boolean {
    return this.user && this.user.userinfo && this.user.multiUser
  }

  get culture() {
    return this.translate.currentLang
  }

  get hasUnsavedNotes(): boolean { // : visitNote[]
    const notes: any[] = this.storage.get('saved_notes')

    if (!notes || notes.length < 1 || !this.user.activeUser) {
      return false
    }

    return notes.filter(x => x.customer === this.user.activeUser.id
      && x.address === this.user.activeUser.address).length > 0
  }

  get hasUnsendCarts(): boolean {
    if (this.cart && this.cart.carts) {
      return this.cart.carts.length > 0
    }
    return false
  }
}
