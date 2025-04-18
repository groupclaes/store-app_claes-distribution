import { Subscription } from 'rxjs'
import { DatePipe } from '@angular/common'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  ViewChild,
  ViewEncapsulation
} from '@angular/core'
import { ActivatedRoute, NavigationEnd, Params, Router } from '@angular/router'
import { AlertController, IonContent } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { filter } from 'rxjs/operators'
import { CartService } from 'src/app/core/cart.service'
import { CategoriesRepositoryService, ICategoryT } from 'src/app/core/repositories/categories.repository.service'
import { IProductT, ISortOrder, ProductsRepositoryService } from 'src/app/core/repositories/products.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { UserService } from 'src/app/core/user.service'
import { NetworkService } from 'src/app/@shared/network.service'
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { ICartDetail, ICartDetailProductT } from '../../core/repositories/carts.repository.service'
import { LoggerService } from '../../@shared/logging/log.service'

const UNAVAILABLE_AFTER = new Date(2050, 11, 31)

const logger = new LoggerService('ProductsPage')

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush // comment this if there are still un-updated input fields
})
export class ProductsPage implements OnDestroy {
  private _products: IProductT[]
  private _routerEventSubscription: Subscription
  private _subs: Subscription[] = []

  @ViewChild(IonContent) content: IonContent
  @ViewChild(CdkVirtualScrollViewport) virtualScroll: CdkVirtualScrollViewport

  loading: boolean = true
  loadingAdditional: boolean = false
  noMoreProducts: boolean = false
  lastSync: Date

  displayThumbnail: boolean = false
  sortOrder: ISortOrder = 'itemNum$ASC'

  private _debounce_timer: number
  private _filters: IProductFilters = {
    newState: 'default',
    promoState: 'default',
    favoriteState: 'default',
    orderState: 'default',
    category: null,
    query: '',
    attributes: []
  }

  constructor(
    private ref: ChangeDetectorRef,
    private user: UserService,
    private translate: TranslateService,
    private cart: CartService,
    private alertCtrl: AlertController,
    private datePipe: DatePipe,
    categoriesRepository: CategoriesRepositoryService,
    private repo: ProductsRepositoryService,
    private settings: SettingsService,
    route: ActivatedRoute,
    router: Router,
    public network: NetworkService
  ) {
    let fallback: number

    this.settings.showThumbnail.then((value: boolean): void => {
      this.displayThumbnail = value
      this.ref.markForCheck()
    })
    this.settings.defaultFilters().then((filters: any): void => {
      this._filters.newState = (filters.filter_new === true) ? 'active' : 'default'
      this._filters.promoState = (filters.filter_promo === true) ? 'active' : 'default'
      this._filters.orderState = (filters.filter_order === true) ? 'default' : 'inactive'

      this._filters.favoriteState = (filters.filter_favorite === true) ? 'active' : (
        (filters.filter_favorite === false) ? 'default' : 'inactive'
      )

      if (this.user.activeUser) {
        fallback = window.setTimeout(async (): Promise<void> => {
          await this.load(true)
        }, 180)
      }
    })

    this._routerEventSubscription = router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(async (): Promise<void> => {
        window.clearTimeout(fallback)
        this._filters.category = undefined
        fallback = window.setTimeout(async (): Promise<void> => {
          await this.load(true)
        }, 180)
      })

    this._subs.push(route.queryParams.subscribe(async (params: Params): Promise<void> => {
      let cc: number | undefined = params.category ? +params.category : undefined
      if (this.filter.query === (params.query ?? '') && cc === this._filters.category?.id)
        return

      if (params.category)
        this._filters.category = await categoriesRepository.find(+params.category, this.culture)
      else if (this._filters.category !== undefined)
        this._filters.category = undefined
      if (params.query)
        this.filter.query = params.query

      window.clearTimeout(fallback)
      fallback = window.setTimeout(async (): Promise<void> => {
        await this.load(true)
      }, 180)
    }))

    this.network.connected.subscribe((): void => {
      this.ref.markForCheck()
    })
  }

  ngOnDestroy(): void {
    this._routerEventSubscription.unsubscribe()

    for (let sub of this._subs) {
      if (!sub?.closed)
        sub?.unsubscribe()
    }
  }

  get canPromo(): boolean {
    return this.user && this.user.activeUser && this.user.activeUser.promo && this.user.activeUser.promo == true
  }

  get isGuest(): boolean {
    return this.user.isGuest
  }

  get filter(): $TSFixMe {
    return this._filters
  }

  get favoriteFilter(): boolean {
    return this._filters.favoriteState === 'active'
  }

  get products(): IProductT[] {
    return this._products || []
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get category(): number {
    if (this._filters && this._filters.category)
      return this._filters.category.id
    return undefined
  }

  get pageTitle(): string {
    if (this._filters && this._filters.category)
      return this._filters.category.name
    return this.translate.instant('productsPage')
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }

  get currentCustomer(): string {
    if (this.user.hasAgentAccess) {
      return '  -  ' + (this.user.activeUser.addressName != null
        ? `${this.user.activeUser.address} ${this.user.activeUser.addressName}` : `${this.user.activeUser.id} ${this.user.activeUser.name}`)
    } else if (this.user.multiUser) {
      return '  -  ' + (this.user.activeUser.addressName != null
        ? this.user.activeUser.addressName : this.user.activeUser.name)
    }
    return ''
  }

  get cartLink(): $TSFixMe[] {
    const params: $TSFixMe[] = ['/carts']
    if (this.cart.active)
      params.push(this.cart.active.id)
    return params
  }

  ionViewDidLeave(): void {
    this._routerEventSubscription.unsubscribe()
  }

  async ionViewDidEnter(): Promise<void> {
    try {
      logger.debug('ProductsPage.ionViewDidEnter() -- start')
      await this.cart.loadCarts()
      await this.cart.updateActive(this.user.activeUser.id, this.user.activeUser.address)
      if (this._products && this._products.length > 0) {
        if (
          this.cart.active &&
          this.cart.active.customer === this.user.activeUser.id &&
          this.cart.active.address === this.user.activeUser.address &&
          this.cart.active.products) {
          // update cart amounts
          for (const product of this.products) {
            product.amount = this.cart.active.products.find((x: ICartDetailProductT): boolean => x.id == product.id)?.amount ?? null
          }
        } else {
          this.products.forEach((x: IProductT): $TSFixMe => x.amount = null)
        }
        this.ref.markForCheck()
      }
    } catch (err) {
      logger.error('ProductsPage.ionViewDidEnter() -- error', err)
    } finally {
      logger.debug('ProductsPage.ionViewDidEnter() -- end')
      this.ref.detectChanges()
    }
  }

  async search(event: $TSFixMe): Promise<void> {
    this.filter.query = event.target.value
    await this.load()
  }

  async load(force?: boolean): Promise<void> {
    if (!force)
      if (this.loading === true)
        return

    this._products = []
    this.noMoreProducts = false
    this.loading = true
    this.ref.markForCheck()

    const products = await this.repo.queryAll(this.culture, this._filters, this.sortOrder, [
      this.user.activeUser.id,
      this.user.activeUser.address,
      this.user.activeUser.addressGroup
    ])

    const cart: ICartDetail = (this.cart || this.cart.active) ? this.cart.active : null

    for (const product of products) {
      product.isNew = product.isNew == 1
      product.isPromo = product.isPromo == 1
      product.isFavorite = product.isFavorite == 1

      if (cart)
        product.amount = cart.products.find((x: ICartDetailProductT): boolean => x.id == product.id)?.amount ?? null
    }

    this._products = products

    this.loading = false
    this.loadingAdditional = false
    this.virtualScroll.scrollToIndex(0)
    this.ref.markForCheck()
  }

  async toggleNewFilter(): Promise<void> {
    switch (this._filters.newState) {
      case 'active':
        this._filters.newState = 'default'
        break

      default:
        this._filters.newState = 'active'
        break
    }
    await this.load()
  }

  async togglePromoFilter(): Promise<void> {
    switch (this._filters.promoState) {
      case 'active':
        this._filters.promoState = 'default'
        break

      default:
        this._filters.promoState = 'active'
        break
    }
    await this.load()
  }

  async toggleFavoriteFilter(): Promise<void> {
    switch (this._filters.favoriteState) {
      case 'active':
        this._filters.favoriteState = 'inactive'
        break

      case 'default':
        this._filters.favoriteState = 'active'
        break

      case 'inactive':
        this._filters.favoriteState = 'default'
        break
    }
    await this.load()
  }

  async toggleOrderFilter(): Promise<void> {
    switch (this._filters.orderState) {
      case 'default':
        this._filters.orderState = 'inactive'
        break

      default:
        this._filters.orderState = 'default'
        break
    }
    await this.load()
  }

  async changeSortOrder(): Promise<void> {
    if (this.sortOrder !== 'itemNum$ASC' && !this.favoriteFilter) {
      // revert to normal
      this.sortOrder = 'itemNum$ASC'
      await this.load()
    }
    switch (this.sortOrder) {
      case 'itemNum$ASC':
        // set sort order to favoriteBoughtDateDesc
        this.sortOrder = 'favoriteBoughtDate$DESC'
        await this.load()
        break

      default:
        // set sort order to default
        this.sortOrder = 'itemNum$ASC'
        await this.load()
        break
    }
  }

  changeProductAmount($event: $TSFixMe, product: $TSFixMe): void {
    clearTimeout(this._debounce_timer)
    this._debounce_timer = window.setTimeout(async (): Promise<void> => {
      const productId: number = product.id
      // make sure no negative values are passed if defined
      let productAmount: number = $event.target.value ? Math.abs($event.target.value) : -1
      let showAlert: boolean = false
      this.ref.markForCheck()
      logger.debug('changeProductAmount() -- start ', productId, productAmount,
        this.user.activeUser.id, this.user.activeUser.address,
        this.user.credential)

      // check if item had minOrderQuantity
      if (product.minOrder > 1) {
        logger.info('this product has a minOrderQuantity')
        if (productAmount > 0 && productAmount < product.minOrder) {
          productAmount = product.minOrder
          product.amount = productAmount
          this.ref.markForCheck()
          showAlert = true
        }
      }

      if (product.stackSize > 1) {
        if (productAmount > 0 && (productAmount % product.stackSize) != 0) {
          const i: number = Math.floor(productAmount / product.stackSize) + 1
          productAmount = i * product.stackSize
          product.amount = productAmount
          this.ref.markForCheck()
          showAlert = true
        }
      }

      // Always update amount even if it has been changed by validation
      await this.cart.setProduct(productId, productAmount,
        this.user.activeUser.id, this.user.activeUser.address,
        this.user.credential)

      if (showAlert) {
        const alert: HTMLIonAlertElement = await this.alertCtrl.create({
          header: this.translate.instant('invalidAmountError'),
          message: this.translate.instant('invalidAmountMessageError') + productAmount
        })
        alert.present()
      }
      logger.debug('changeProductAmount() -- end ', productId, productAmount)
    }, 200)
  }

  newState: (product: $TSFixMe) => 'active' | 'inactive' = (product: $TSFixMe): 'active' | 'inactive' => product.isNew ? 'active' : 'inactive'

  promoState: (product: $TSFixMe) => 'active' | 'inactive' = (product: $TSFixMe): 'active' | 'inactive' => this.canPromo && product.isPromo ? 'active' : 'inactive'

  favoriteState: (product: $TSFixMe) => 'active' | 'inactive' = (product: $TSFixMe): 'active' | 'inactive' => product.isFavorite ? 'active' : 'inactive'

  orderState: (product: $TSFixMe) => 'active' | 'inactive' = (product: $TSFixMe): 'active' | 'inactive' => product.type === 'B' ? 'active' : 'inactive'

  resetFilters(): void {
    this.settings.defaultFilters().then(async (filters: any): Promise<void> => {
      this._filters.newState = (filters.filter_new === true) ? 'active' : 'default'
      this._filters.promoState = (filters.filter_promo === true) ? 'active' : 'default'
      this._filters.orderState = (filters.filter_order === true) ? 'default' : 'inactive'

      this._filters.favoriteState = (filters.filter_favorite === true) ? 'active' : (
        (filters.filter_favorite === false) ? 'default' : 'inactive'
      )

      if (this.user.activeUser)
        await this.load()
    })
  }

  favinfo(product: IProductT): string {
    if (product.isFavorite) {
      const lastPurchaseDate: string = this.datePipe.transform(product.favLastB, 'dd/MM/yyyy', undefined, this.culture)
      return `${this.translate.instant('lastPurchase')}: ${lastPurchaseDate} ${product.favLastA}x`
    }
    return null
  }

  availableDescription(product: IProductT): string {
    if (product.availableOn) {
      if (new Date(product.availableOn).toISOString() === UNAVAILABLE_AFTER.toISOString()) {
        return this.translate.instant('productUnavailable')
      }
      const availableOn: string = this.datePipe.transform(product.availableOn, 'dd/MM/yyyy', undefined, this.culture)
      return `${this.translate.instant('availableOn')} ${availableOn}`
    }
    return ''
  }

  productById(index: number, product: IProductT): number {
    return product.id
  }

  get isAgent(): boolean {
    return this.user.hasAgentAccess
  }
}

export class AttributesFilter {
  group: number
  selected: number[]
}

export interface IProductFilters {
  category: ICategoryT
  query: string
  newState: 'default' | 'active'
  promoState: 'default' | 'active'
  favoriteState: 'default' | 'active' | 'inactive'
  orderState: 'default' | 'inactive'
  attributes: AttributesFilter[]
}
