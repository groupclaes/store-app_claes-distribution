import { UserService } from './core/user.service'
import { environment } from '../environments/environment.prod'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core'

import { registerLocaleData } from '@angular/common'
import localeFrBE from '@angular/common/locales/fr-BE'
import localeNlBE from '@angular/common/locales/nl-BE'
import { IonMenu, LoadingController, NavController, Platform } from '@ionic/angular'
import { LoggerService } from './@shared/logging/log.service'
import { TranslateService } from '@ngx-translate/core'
import { StorageProvider } from './core/storage-provider.service'
import { CartService } from './core/cart.service'
import { NetworkService } from './@shared/network.service'

registerLocaleData(localeFrBE)
registerLocaleData(localeNlBE)

const logger = new LoggerService('AppComponent')

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  @ViewChild('menu') menu: IonMenu

  constructor(
    private platform: Platform,
    private translate: TranslateService,
    private storage: StorageProvider,
    private navCtrl: NavController,
    private loadCtrl: LoadingController,
    private ref: ChangeDetectorRef,
    private user: UserService,
    private cart: CartService,
    public network: NetworkService
  ) {
    logger.info('MyApp.constructor() -- started.')

    platform.ready().then(() => {
      logger.info('MyApp.constructor() -- Platform is ready')

      this.navCtrl.navigateRoot('/account/login')
    })
    this.network.connected.subscribe(() => this.ref.markForCheck())
    this.initTranslate()
  }

  get menuItemsActive(): boolean {
    return !(this.user && (!this.user.activeUser && this.user.userinfo && this.user.multiUser))
  }

  get isGuest(): boolean {
    return this.user.isGuest
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

  get hasActiveUser(): boolean {
    return this.user?.activeUser?.id != null
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

  get isAndroid(): boolean {
    return this.platform.is('android')
  }

  async initTranslate() {
    this.translate.setDefaultLang(environment.default_language)
    this.translate.addLangs(environment.supported_languages)

    const browserLang: string = this.translate.langs.find((x: string): boolean => x.startsWith(this.translate.getBrowserLang())) || undefined
    this.translate.use(browserLang ?? environment.default_language)
  }

  async open(componentName: string) {
    if (componentName === '/account/login' && !this.isGuest) {
      const loader = await this.loadCtrl.create({
        message: this.translate.instant('logout')
      })
      await loader.present().then(_ => this.ref.markForCheck())
      try {
        await this.user.logout()
      } finally {
        loader.dismiss()
      }
    }
    if (await this.navCtrl.navigateRoot(componentName)) {
      await this.menu.close()
    }
  }
}
