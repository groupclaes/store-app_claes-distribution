import { firstValueFrom } from 'rxjs';
/* eslint-disable @typescript-eslint/dot-notation */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AlertController, LoadingController, NavController, ToastController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { ApiService } from 'src/app/core/api.service'
import { CartService } from 'src/app/core/cart.service'
import { CartsRepositoryService, ICartDetailS, ICartDetailProductA, ICartDetailSettings }
  from 'src/app/core/repositories/carts.repository.service'
import { IAppDeliveryScheduleModel } from 'src/app/core/repositories/customers.repository.service'
import { ShippingCostsRepositoryService } from 'src/app/core/repositories/shipping-costs.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { UserService } from 'src/app/core/user.service'

@Component({
  selector: 'app-cart-detail',
  templateUrl: './cart-detail.page.html',
  styleUrls: ['./cart-detail.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartDetailPage implements OnInit {
  displayThumbnail = false
  loading = true

  view = 'productsView'
  delvDates = []
  productsPrice = 0
  taxesPrice = 0
  deliveryPrice = 0
  invoiceForm: ICartDetailSettings

  private _cart: ICartDetailS
  private _history = false;

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private user: UserService,
    private logger: LoggingProvider,
    private api: ApiService,
    private repo: CartsRepositoryService,
    private shippingCostRepository: ShippingCostsRepositoryService,
    private cart: CartService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController,
    settings: SettingsService,
    private route: ActivatedRoute
  ) {
    settings.DisplayThumbnail.subscribe((displayThumbnail: boolean) => {
      this.displayThumbnail = displayThumbnail
      this.ref.markForCheck()
    })
    route.params.subscribe(params => {
      this.load(+params.id)
    })
  }


  get step1Class(): string {
    switch (this.view) {
      case 'productsView':
        return 'active'

      default:
        return 'completed'
    }
  }

  get step2Class(): string {
    switch (this.view) {
      case 'productsView':
        return ''

      case 'invoiceView':
        return 'active'

      default:
        return 'completed'
    }
  }

  get step3Class(): string {
    switch (this.view) {
      case 'summaryView':
        return 'active'

      case 'done':
        return 'completed'

      default:
        return ''
    }
  }

  get allowSend(): boolean {
    return this.view === 'summaryView' || this.isAgent
  }

  get currentCart() {
    return this._cart
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

  get isHistory() {
    return this._history;
  }

  ngOnInit() {
    this.route.queryParams.subscribe(x => {
      this._history = x['history'] === 'true';
      console.log(x)
    })
  }

  async load(id: number) {
    this.logger.debug('CartDetailPage.load(' + id + ') -- start')
    try {
      this.loading = true
      this.ref.markForCheck()

      const cart = await this.repo.load(id, this.culture)

      if (cart.settings) {
        this.logger.debug('CartDetailPage.load(' + id + ') -- has settings')
        this.invoiceForm = {
          commentsMachines: '',
          ...cart.settings
        }
      }
      this._cart = cart


      const deliveryTimes = await firstValueFrom(this.api.get<string[]>(
        `order/deliverTimes/${this.user.activeUser.id}/${this.user.activeUser.address}`,
        { userCode: this.user.userinfo.userCode }))

      if (deliveryTimes != null) {
        const dates: string[] = []
        for (const date of deliveryTimes) {
          dates.push(date.split('T')[0])
        }
        this.delvDates = dates
      }
    } catch (err) {
      this.logger.error('CartDetailPage.load(' + id + ') -- error', err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
      this.logger.debug('CartDetailPage.load(' + id + ') -- end')
    }
  }

  async send() {
    const loading = await this.loadingCtrl.create({
      message: this.translate.instant('sendingCart')
    });
    loading.present()
    this.ref.markForCheck()

    this._cart.settings = this.invoiceForm
    const sendOk = await this.cart.sendCart(this._cart)
    loading.dismiss();
    if (!sendOk) {
      this.toastCtrl.create({
        message: this.translate.instant('cartSendError'),
        duration: 10000
      });
    }
    await this.cart.deleteCart(this._cart)

    this.navCtrl.pop();
    this.ref.markForCheck();
  }

  async delete() {
    await this.cart.deleteCart(this._cart);
    this.navCtrl.pop();
    this.ref.markForCheck();
  }

  async changeProductAmount($event: any, product: ICartDetailProductA) {
    let productId = product.id
    let productAmount = $event.target.value || 0
    let showAlert = false
    this.ref.markForCheck()

    const credential = this.user.credential
    const customerId = this._cart.customer
    const addressId = this._cart.address

    // check if item had minorderQuantity
    if (product.minOrder > 1) {
      this.logger.info('this product has a minOrderQuantity')
      if (productAmount > 0 && productAmount < product.minOrder) {
        productAmount = product.minOrder
        product.amount = productAmount
        console.log(productAmount, product.minOrder, product.amount)
        this.ref.markForCheck()
        showAlert = true
      }
    }

    if (product.stackSize > 1) {
      if (productAmount > 0 && (productAmount % product.stackSize) != 0) {
        const subr = Math.floor(productAmount / product.stackSize) + 1

        productAmount = subr * product.stackSize
        product.amount = productAmount
        this.ref.markForCheck()
        showAlert = true
      }
    }

    if (showAlert) {
      const alert = await this.alertCtrl.create({
        header: this.translate.instant('invalidAmountError'),
        message: this.translate.instant('invalidAmountMessageError') + productAmount
      })
      alert.present()
    }

    this.cart.updateProduct(
      productId,
      productAmount,
      customerId,
      addressId,
      credential,
      this._cart.id
    )
    this.ref.markForCheck()
  }

  removeProduct(product: ICartDetailProductA) {
    const productId = product.id
    const productAmount = -1

    const credential = this.user.credential
    const customerId = this._cart.customer
    const addressId = this._cart.address

    this.cart.updateProduct(
      productId,
      productAmount,
      customerId,
      addressId,
      credential,
      this._cart.id
    )
    this._cart.products = this._cart.products.filter(e => e.id !== productId)
    this.ref.markForCheck()
  }

  async calculatePricesOverview() {
    this.productsPrice = 0
    this.deliveryPrice = 0
    this.taxesPrice = 0

    try {
      for (let product of this._cart.products) {
        const amount = product.amount || 0
        let myStack = { quantity: 0, amount: 0 }
        for (let price of product.prices) {
          if (price.quantity <= amount && price.quantity > myStack.quantity)
            myStack = price
        }
        this.productsPrice += parseFloat((myStack.amount * amount).toFixed(2))
      }

      const shippingCosts = await this.shippingCostRepository.get(
        this._cart.customer,
        this._cart.address
      )

      for (let shippingCost of shippingCosts) {
        if (this.productsPrice < shippingCost.threshold) {
          this.deliveryPrice = shippingCost.amount
        }
      }
    } catch (err) {
      this.logger.error('CartDetailPage.calculatePricesOverview() -- error', err)
    } finally {
      this.ref.markForCheck()
    }
  }

  async setView(view: string) {
    if (view == 'summaryView') {
      await this.calculatePricesOverview()
    }
    this.view = view
    this.ref.markForCheck()
  }

  async onChange() {
    if (!this._cart || this.loading) return
    this.logger.debug('CartDetailPage.onChange() called')

    await this.repo.updateSettings(this._cart.id, this.invoiceForm)
  }

  async showDeleteConfirmation(): Promise<void> {
    try {
      const alert = await this.alertCtrl.create({
        header: this.translate.instant('cartDeletionWarning'),
        buttons: [
          {
            text: this.translate.instant('actions.cancel'),
            role: 'cancel',
            handler: () => { }
          }, {
            text: this.translate.instant('yes'),
            role: 'destructive',
            handler: () => this.delete()
          }
        ]
      })
      await alert.present()
    } catch (err) {
      this.logger.error('CartDetailPage.showDeleteConfirmation() error', err)
    }
  }
}
