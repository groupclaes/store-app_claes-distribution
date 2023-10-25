import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { ActivatedRoute } from '@angular/router'
import { AlertController, ToastController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { ApiService } from 'src/app/core/api.service'
import { CartService } from 'src/app/core/cart.service'
import { IPCMAttachmentEntry, IProductDetailT, IProductPrice, IRecipeModuleEntry, ProductsRepositoryService } from 'src/app/core/repositories/products.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { UserService } from 'src/app/core/user.service'
import { environment } from 'src/environments/environment'

const UNAVAILABLE_AFTER = new Date('2050-12-31')

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailPage implements OnInit {
  loading = true
  recipeCount = 5
  showContentUnit = false
  displayThumbnail: boolean

  _product: IProductDetailT
  recipes: IPCMAttachmentEntry[] = []
  recipesModule: IRecipeModuleEntry[] = []
  datasheets: IPCMAttachmentEntry[] = []
  usageManuals: IPCMAttachmentEntry[] = []

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private repo: ProductsRepositoryService,
    private cart: CartService,
    private api: ApiService,
    private logger: LoggingProvider,
    private sanitizer: DomSanitizer,
    public user: UserService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    settings: SettingsService,
    route: ActivatedRoute
  ) {
    logger.log('ProductDetailPage -- constructor()')
    settings.DisplayThumbnail.subscribe((displayThumbnail: boolean) => {
      this.displayThumbnail = displayThumbnail
    })
    route.params.subscribe(async (params) => {
      if (+params['id']) {
        await this.load(+params['id'])
      }
    })
  }

  ngOnInit() {
  }

  async load(id: number) {
    try {
      this.loading = true
      this.ref.markForCheck()

      this._product = await this.repo.getDetail(
        id,
        this.user.activeUser,
        this.culture
      )


      const cart = (this.cart || this.cart.active) ? this.cart.active : null
      if (cart) {
        const pr = cart.products.find(x => x.id == this._product.id)
        this._product.amount = (pr !== undefined) ? pr.amount : null
      }
    } catch (err) {
      this.logger.error(err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }

    this.getAttachments()
  }

  async getAttachments() {
    try {
      const res = await this.repo.getAttachments(this._product.id, this._product.itemnum, this.culture)
      if (res) {
        this.datasheets = res.datasheets
        this.recipes = res.recipes
        this.recipesModule = res.recipesModule
        this.usageManuals = res.usageManuals
      }
    } catch (err) {
      this.logger.error(err)
    } finally {
      this.ref.markForCheck()
    }
  }

  setAmount(amount: number) {
    if (!this._product.availableOn) {
      this._product.amount = amount
      this.changeProductAmount()
      this.ref.markForCheck()
    } else {
      alert(this.translate.instant('productUnavailable'))
    }
  }

  async copyMessage(val: string) {
    navigator.clipboard.writeText(val)

    const toast = await this.toastCtrl.create({
      message: this.translate.instant('messages.copiedToClipboard')
    })
    toast.present()
  }

  showImageModal() { }

  isCurrentStack(price: IProductPrice): string {
    let ladderfound = false
    let ladder: IProductPrice

    for (let i = 0; i < this._product.prices.length; i++) {
      ladderfound = (this._product.prices[i].quantity <= this._product.amount)
      ladder = this._product.prices[i]
      if (ladderfound === true) break
    }

    console.log(ladderfound)

    return (ladderfound && ladder.quantity == price.quantity) ? 'selected-price' : ''
  }
  removeFromDepartment(departmentId: number) { }

  showAllRecipes() {
    this.recipeCount = 99
  }

  showDocumentActionSheet(doc: $TSFixMe) { }
  showRecipeActionSheet(recipe: $TSFixMe) { }

  openRecipe(recipe: IRecipeModuleEntry) {
    switch (this.culture) {
      case 'fr-BE':
        window.open(`https://recettes.claes-distribution.be/recipe/${recipe.id}/${recipe.name.replace('/ /g', '-')}`, '_system', 'location=yes')
        break

      case 'nl-BE':
      default:
        window.open(`https://recepten.claes-distribution.be/recipe/${recipe.id}/${recipe.name.replace('/ /g', '-')}`, '_system', 'location=yes')
        break
    }
  }
  showActions() { }

  safe(html: string) {
    return this.sanitizer.bypassSecurityTrustHtml(html)
  }

  async changeProductAmount() {
    const productId = this._product.id
    let productAmount = this._product.amount || -1
    let showAlert = false
    this.ref.markForCheck()

    const customerId = this.user.activeUser.id
    const addressId = this.user.activeUser.address
    const credential = this.user.credential

    // check if item had minorderQuantity
    if (this._product.minOrder > 1) {
      this.logger.info('this product has a minOrderquantity')
      if (productAmount > 0 && productAmount < this._product.minOrder) {
        productAmount = this._product.minOrder
        this._product.amount = productAmount
        this.ref.markForCheck()
        showAlert = true
      }
    }

    if (this._product.stackSize > 1) {
      if (productAmount > 0 && (productAmount % this._product.stackSize) != 0) {
        const subr = Math.floor(productAmount / this._product.stackSize) + 1

        productAmount = subr * this._product.stackSize
        this._product.amount = productAmount
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

    this.cart.updateProduct(productId, productAmount, customerId, addressId, credential)
    this.ref.markForCheck()
  }

  get productName(): string {
    if (this._product) {
      return `${this._product.name}`
    }
    return '(unknown)'
  }

  get productImage(): string {
    if (this._product) {
      return `${environment.pcm_url}/product-images/dis/${this._product.itemnum}`
    }
    return null
  }

  get allowPromo(): boolean {
    if (this._product && this._product.promo && this._product.promo.length > 0 && this.user.activeUser.promo) {
      return this._product.isPromo && this.user.activeUser.promo
    }
    return false
  }

  get product(): IProductDetailT | undefined {
    if (this._product)
      return this._product
    return undefined
  }

  get isFood(): boolean {
    if (this._product && this._product.itemnum) {
      const itemnum = parseInt(this._product.itemnum.toString().substring(0, 3), 10)
      return itemnum <= 136
    }
    return false
  }

  get isUnavailable(): boolean {
    if (this._product.availableOn) {
      return new Date(this._product.availableOn + ".000Z") >= UNAVAILABLE_AFTER
    }
    return false
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }

  get cartLink(): any[] {
    const params: any[] = ['/carts']
    if (this.cart.active) params.push(this.cart.active.id)
    return params
  }
}
