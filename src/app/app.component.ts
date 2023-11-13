import { UserService } from './core/user.service'
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

  constructor(
    platform: Platform,
    logger: LoggingProvider,
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

      this.navCtrl.navigateRoot('/account/login')
    })
    this.initTranslate()
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

  get isActivePromo(): boolean {
    return this.isAgent || this.user.activeUser?.promo === true
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

  async initTranslate() {
    this.translate.setDefaultLang(environment.default_language)
    const browserLang = this.translate.getBrowserCultureLang()

    this.translate.addLangs(environment.supported_languages)

    if (browserLang && this.translate.langs.some(e => e === browserLang)) {
      this.translate.use(browserLang)
    } else {
      this.translate.use(environment.default_language)
    }

    console.log(environment.default_language, browserLang, this.translate.langs, this.translate.currentLang)
  }

  async open(componentName: string) {
    if (componentName === '/account/login') {
      this.user.logout()
    }
    if (await this.navCtrl.navigateRoot(componentName)) {
      await this.menu.close()
    }
  }

  openLeaflet(): void {
    // this.statistics.leafletView(this.user.userinfo.userId)
    window.open(
      `https://pcm.groupclaes.be/v3/content/dis/website/month-leaflet/100/${this.culture.split('-')[0]}`,
      '_system', 'location=yes')
  }
}
