import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { LoadingController, NavController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { CartService } from 'src/app/core/cart.service'
import { CartsRepositoryService, ICartDetail } from 'src/app/core/repositories/carts.repository.service'
import { UserService } from 'src/app/core/user.service'

@Component({
  selector: 'app-carts',
  templateUrl: './carts.page.html',
  styleUrls: ['./carts.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartsPage implements OnInit {
  loading = true
  loader: HTMLIonLoadingElement
  unsendCount = 0
  showSelects = false

  private _carts: ICartDetailCustom[] = []
  private _cartsNotSend: ICartDetailCustom[] = []

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private user: UserService,
    private repo: CartsRepositoryService,
    private cart: CartService,
    private logger: LoggingProvider,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController
  ) { }

  ngOnInit() {
    this.load()
  }

  async load(viewReload: boolean = false): Promise<void> {
    try {
      this.loading = true
      this.ref.markForCheck()

      this._carts = []
      this._cartsNotSend = []
      this.unsendCount = await this.repo.failedCount()

      const carts = (await this.repo.loadUnsent(this.culture)) as ICartDetailCustom[]

      for (const cart of carts) {
        cart.selected = true
      }

      this._carts = carts
      // this._cartsNotSend = carts.filter(e => e.sendOk == false)
    } catch (err) {
      this.logger.error('CartsPage.load() -- error', err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }

    if (!viewReload && this._carts.length === 1 && this.user.userinfo.type === 1) {
      this.navCtrl.navigateForward(
        `/carts/${this._carts[0].id}`
      )
    }
  }

  async create() {
    try {
      this.loading = true
      this.ref.markForCheck()


      await this.cart.createCart(this.user.activeUser.id, this.user.activeUser.address, this.user.credential)
      await this.load()
    } catch (err) {
      this.logger.error('CartsPage.create() -- error', err)
    } finally {
      if (this.loading) {
        this.loading = false
        this.ref.markForCheck()
      }
    }
  }

  async delete(cart: ICartDetail): Promise<boolean> {
    try {
      this.loading = true
      this.ref.markForCheck()

      return true
    } catch (err) {
      this.logger.error('CartsPage.create() -- error', err)
    } finally {
      if (this.loading) {
        this.loading = false
        this.ref.markForCheck()
      }
    }
  }

  async send(cart: ICartDetail, reload: boolean = false): Promise<void> {
    let setLoader = false

    try {
      if (!this.loader) {
        setLoader = true
        this.loading = true
        this.loader = await this.loadingCtrl.create({
          message: this.translate.instant('sendingCart')
        })
        await this.loader.present()
        this.ref.markForCheck()
      }


    } catch (err) {
      this.logger.error('CartsPage.create() -- error', err)
    } finally {
      if (setLoader) {
        this.loading = false
        this.loader.dismiss()
        this.ref.markForCheck()
      }
    }

    if (reload) {
      this.load()
    }
  }

  async sendSelected(): Promise<void> {
    try {
      this.loading = true
      this.loader = await this.loadingCtrl.create({
        message: this.translate.instant('sendingCart')
      })
      await this.loader.present()
      this.ref.markForCheck()

      const selectedCarts = this._carts.filter((e: $TSFixMe) => e.selected === true)
      for (const cart of selectedCarts) {
        await this.send(cart)
      }
      this.load()
    } catch (err) {
      this.logger.error('CartsPage.create() -- error', err)
    } finally {
      if (this.loader) {
        this.loading = false
        this.loader.dismiss()
        this.ref.markForCheck()
      }
    }
  }

  async setActive(cart: ICartDetail) {
    if (await this.repo.changeActive(cart.id)) {
      cart.active = true
    }
    this.ref.markForCheck()
  }

  toggleMode() {
    setTimeout(() => {
      this.showSelects = !this.showSelects
      this.ref.markForCheck()
    }, 18)
  }

  ionViewWillEnter() {
    this.load(true)
  }

  get carts(): ICartDetailCustom[] {
    return this._carts
  }

  get menuItemsActive(): boolean {
    return this.user.multiUser
  }

  get isAgent(): boolean {
    return this.user.hasAgentAccess
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }
}

export interface ICartDetailCustom extends ICartDetail {
  selected: boolean;
}
