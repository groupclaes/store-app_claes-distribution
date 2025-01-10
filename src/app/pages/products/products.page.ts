import { firstValueFrom, Subscription } from 'rxjs';
/* eslint-disable eqeqeq */
import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core'
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router'
import { AlertController, IonContent } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { Observable, Subject, of } from 'rxjs'
import { debounceTime, filter, take } from 'rxjs/operators'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { CartService } from 'src/app/core/cart.service'
import { CategoriesRepositoryService, ICategoryT } from 'src/app/core/repositories/categories.repository.service'
import { IProductT, ISortOrder, ProductsRepositoryService } from 'src/app/core/repositories/products.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { UserService } from 'src/app/core/user.service'
import { NetworkService } from 'src/app/@shared/network.service';
import { Store } from 'src/app/core/sync.service';
import { DataIntegrityChecksumsRepositoryService } from 'src/app/core/repositories/data-integrity-checksums.repository.service';

const UNAVAILABLE_AFTER = new Date('2050-12-31')

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsPage {
  private _products: IProductT[]
  private _updateCartProduct = new Subject<{ productId: number, amount: number }>()
  private _routerEventSubscription: Subscription;

  @ViewChild(IonContent) content: IonContent

  loading = true
  loadingAdditional = false
  noMoreProducts = false
  lastSync: Date

  page = 0
  increment = 36
  limit = 252
  displayThumbnail = false
  sortOrder: ISortOrder = 'itemNum$ASC'

  updateCartProduct: Observable<{ productId: number, amount: number }>
    = this._updateCartProduct.asObservable().pipe(debounceTime(500))

  private _filters: {
    category: ICategoryT;
    query: string;
    newState: 'default' | 'active';
    promoState: 'default' | 'active';
    favoriteState: 'default' | 'active' | 'inactive';
    orderState: 'default' | 'inactive';
    attributes: AttributesFilter[];
  } = {
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
    private logger: LoggingProvider,
    private alertCtrl: AlertController,
    private datePipe: DatePipe,
    categoriesRepository: CategoriesRepositoryService,
    private repo: ProductsRepositoryService,
    private repoChk: DataIntegrityChecksumsRepositoryService,
    private settings: SettingsService,
    route: ActivatedRoute,
    router: Router,
    private networkService: NetworkService
  ) {
    let fallback
    settings.DisplayThumbnail.subscribe(displayThumbnail => {
      this.displayThumbnail = displayThumbnail
      this.ref.markForCheck()
    })
    firstValueFrom(settings.DisplayDefaultFilters).then(filters => {
      if (filters.new === true) {
        this._filters.newState = 'active'
      } else {
        this._filters.newState = 'default'
      }
      if (filters.promo === true) {
        this._filters.promoState = 'active'
      } else {
        this._filters.promoState = 'default'
      }
      if (filters.favorite === true) {
        this._filters.favoriteState = 'active'
      } else if (filters.favorite === false) {
        this._filters.favoriteState = 'default'
      } else {
        this._filters.favoriteState = 'inactive'
      }
      if (filters.order === true) {
        this._filters.orderState = 'default'
      } else {
        this._filters.orderState = 'inactive'
      }
      if (this.user.activeUser) {
        fallback = setTimeout(() => { this.load(true) }, 180)
      }
    })

    this._routerEventSubscription = router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(async (ev) => {
        // console.log(ev)
        window.clearTimeout(fallback)
        this._filters.category = undefined

        this.load(true)
      })
    route.queryParams.subscribe(async (params) => {
      if (params.category) {
        this._filters.category = await categoriesRepository.find(+params.category, this.culture)
        window.clearTimeout(fallback)
        this.load(true)
      }
    })

    this.networkService.connected.subscribe(async () => {
      this.ref.markForCheck()
      const dataIntegrity = await this.repoChk.get<Store>()
      this.lastSync = dataIntegrity.find(e => e.dataTable === 'lastSync').dateChanged
    })
  }


  get canPromo(): boolean {
    return this.user && this.user.activeUser && this.user.activeUser.promo && this.user.activeUser.promo == true
  }

  get canFilterModal(): boolean { return this._filters.category !== null }

  get hasAttributeFilter(): boolean {
    return this._filters.attributes && this._filters.attributes instanceof Array && this._filters.attributes.length > 0
  }

  get filter(): $TSFixMe {
    return this._filters
  }

  get newFilter(): boolean { return this._filters.newState === 'active' }

  get promoFilter(): boolean { return this._filters.promoState === 'active' }

  get favoriteFilter(): boolean { return this._filters.favoriteState === 'active' }

  get orderFilter(): boolean { return this._filters.orderState === 'inactive' }

  get products(): IProductT[] { return this._products || [] }

  get culture(): string { return this.translate.currentLang }

  get category(): number {
    if (this._filters && this._filters.category) {
      return this._filters.category.id
    }
    return undefined
  }

  get pageTitle(): string {
    if (this._filters && this._filters.category) {
      return this._filters.category.name
    }
    return this.translate.instant('productsPage')
  }

  get backButtonText(): string { return this.translate.instant('backButtonText') }

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

  get cartLink(): any[] {
    const params: any[] = ['/carts']
    if (this.cart.active) {
      params.push(this.cart.active.id)
    }
    return params
  }

  ionViewDidLeave(): void {
    this._routerEventSubscription.unsubscribe()
  }

  async ionViewDidEnter() {
    try {
      this.logger.log('ProductsPage.ionViewDidEnter() -- start')
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
            const pr = this.cart.active.products.find(x => x.id == product.id)
            if (pr) {
              product.amount = pr.amount
            } else {
              product.amount = null
            }
          }
        } else {
          this.products.forEach(x => x.amount = null)
        }
        this.ref.markForCheck()
      }
    } catch (err) {
      this.logger.error('ProductsPage.ionViewDidEnter() -- error', err)
    } finally {
      this.logger.log('ProductsPage.ionViewDidEnter() -- end')
      this.ref.detectChanges()
    }
  }

  async load(force?: boolean): Promise<void> {
    if (!force) {
      if (this.loading === true) {
        return
      }
    }
    this.page = 0
    this._products = []
    this.noMoreProducts = false
    this.loading = true
    this.ref.markForCheck()

    const products = await this.repo.queryAll(this.culture, this._filters, this.sortOrder, [
      this.user.activeUser.id,
      this.user.activeUser.address,
      this.user.activeUser.addressGroup
    ])

    const cart = (this.cart || this.cart.active) ? this.cart.active : null

    for (const product of products) {
      product.isNew = product.isNew == 1
      product.isPromo = product.isPromo == 1
      product.isFavorite = product.isFavorite == 1

      if (cart) {
        const cartProduct = cart.products.find(x => x.id == product.id)
        product.amount = (cartProduct != undefined) ? cartProduct.amount : null
      }
    }

    this._products = products

    this.loading = false
    this.loadingAdditional = false
    this.ref.markForCheck()
  }

  toggleNewFilter() {
    switch (this._filters.newState) {
      case 'active':
        this._filters.newState = 'default'
        break

      default:
        this._filters.newState = 'active'
        break
    }
    this.load()
  }

  togglePromoFilter() {
    switch (this._filters.promoState) {
      case 'active':
        this._filters.promoState = 'default'
        break

      default:
        this._filters.promoState = 'active'
        break
    }
    this.load()
  }

  toggleFavoriteFilter() {
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
    this.load()
  }

  toggleOrderFilter() {
    switch (this._filters.orderState) {
      case 'default':
        this._filters.orderState = 'inactive'
        break

      default:
        this._filters.orderState = 'default'
        break
    }
    this.load()
  }

  changeSortOrder() {
    if (this.sortOrder !== 'itemNum$ASC' && !this.favoriteFilter) {
      // revert to normal
      this.sortOrder = 'itemNum$ASC'
      this.load()
    }
    switch (this.sortOrder) {
      case 'itemNum$ASC':
        // set sortorder to favoriteBoughtDateDesc
        this.sortOrder = 'favoriteBoughtDate$DESC'
        this.load()
        break

      default:
        // set sortorder to default
        this.sortOrder = 'itemNum$ASC'
        this.load()
        break
    }
  }

  async changeProductAmount($event: any, product: $TSFixMe) {
    const productId = product.id
    // make sure no negative values are passed if defined
    let productAmount = $event.target.value ? Math.abs($event.target.value) : -1
    let showAlert = false
    this.ref.markForCheck()
    console.debug('changeProductAmount() --start ', productId, productAmount)

    console.debug(productId, productAmount,
      this.user.activeUser.id, this.user.activeUser.address,
      this.user.credential)

    // check if item had minorderQuantity
    if (product.minOrder > 1) {
      this.logger.info('this product has a minOrderquantity')
      if (productAmount > 0 && productAmount < product.minOrder) {
        productAmount = product.minOrder
        product.amount = productAmount
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
    } else {
      await this.cart.setProduct(productId, productAmount,
        this.user.activeUser.id, this.user.activeUser.address,
        this.user.credential)
    }
    console.debug('changeProductAmount() --end ', productId, productAmount)
  }

  newState = (product: $TSFixMe) => product.isNew ? 'active' : 'inactive'

  promoState = (product: $TSFixMe) => this.canPromo && product.isPromo ? 'active' : 'inactive'

  favoriteState = (product: $TSFixMe) => product.isFavorite ? 'active' : 'inactive'

  orderState = (product: $TSFixMe) => product.type === 'B' ? 'active' : 'inactive'

  resetFilters() {
    this.settings.DisplayDefaultFilters.pipe(take(1)).toPromise().then((filters: $TSFixMe) => {
      if (filters.new === true) {
        this._filters.newState = 'active'
      } else {
        this._filters.newState = 'default'
      }
      if (filters.promo === true) {
        this._filters.promoState = 'active'
      } else {
        this._filters.promoState = 'default'
      }
      if (filters.favorite === true) {
        this._filters.favoriteState = 'active'
      } else if (filters.favorite === false) {
        this._filters.favoriteState = 'default'
      } else {
        this._filters.favoriteState = 'inactive'
      }
      if (filters.order === true) {
        this._filters.orderState = 'default'
      } else {
        this._filters.orderState = 'inactive'
      }
      this._filters.attributes = []
      this._filters.query = ''

      if (this.user.activeUser) {
        this.load()
      }
    })
  }

  isUnavailable(product: any): boolean {
    if (product.AvailableOn) {
      return new Date(product.AvailableOn + '.000Z') >= UNAVAILABLE_AFTER
    }

    return false
  }

  favinfo(product: IProductT): string {
    if (product.isFavorite) {
      const lastPurchaseDate = this.datePipe.transform(product.favLastB, 'dd/MM/yyyy', undefined, this.culture)
      return `${this.translate.instant('lastPurchase')}: ${lastPurchaseDate} ${product.favLastA}x`
    }
    return null
  }

  availableDescription(product: IProductT): string {
    if (product.availableOn) {
      if (new Date(product.availableOn).toISOString() === UNAVAILABLE_AFTER.toISOString()) {
        return this.translate.instant('productUnavailable')
      }
      const availableOn = this.datePipe.transform(product.availableOn, 'dd/MM/yyyy', undefined, this.culture)
      return `${this.translate.instant('availableOn')} ${availableOn}`
    }
    return ''
  }

  productById(index, product: IProductT) {
    return product.id
  }

  get offline(): boolean {
    return this.networkService.offline
  }
}

export class AttributesFilter {
  group: number
  selected: number[]
}
