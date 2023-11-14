import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { ActivatedRoute } from '@angular/router'
import { ActionSheetController, AlertController, ModalController, NavController, ToastController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { CartService } from 'src/app/core/cart.service'
import { ProductsService } from 'src/app/core/products.service'
import { DepartmentsRepositoryService, IDepartmentT } from 'src/app/core/repositories/departments.repository.service'
import { IPCMAttachmentEntry, IProductDetailT, IProductPrice, IRecipeModuleEntry, ProductsRepositoryService }
  from 'src/app/core/repositories/products.repository.service'
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
  pictureOpen = false

  departmentAddOpen = false
  selectedDepartment: number = null
  departments: IDepartmentT[]

  _product: IProductDetailT
  recipes: IPCMAttachmentEntry[] = []
  recipesModule: IRecipeModuleEntry[] = []
  datasheets: IPCMAttachmentEntry[] = []
  usageManuals: IPCMAttachmentEntry[] = []

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private repo: ProductsRepositoryService,
    private products: ProductsService,
    private cart: CartService,
    private logger: LoggingProvider,
    private departmentsRepo: DepartmentsRepositoryService,
    private sanitizer: DomSanitizer,
    public user: UserService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    public modalCtrl: ModalController,
    settings: SettingsService,
    route: ActivatedRoute,
    private actionSheetCtrl: ActionSheetController
  ) {
    logger.log('ProductDetailPage -- constructor()')
    settings.DisplayThumbnail.subscribe((displayThumbnail: boolean) => {
      this.displayThumbnail = displayThumbnail
    })
    route.params.subscribe(async (params) => {
      if (+params.id) {
        await this.load(+params.id)
      }
    })
  }

  get canPromo() {
    // eslint-disable-next-line eqeqeq
    return this.user.activeUser?.promo == true
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
    if (this._product) {
      return this._product
    }
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
      return new Date(this._product.availableOn + '.000Z') >= UNAVAILABLE_AFTER
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
    if (this.cart.active) { params.push(this.cart.active.id) }
    return params
  }

  get actionSheetButtons() {
    const buttons = [
      {
        text: this.translate.instant('messages.addToDepartment'),
        handler: () => this.openAddProductToDepartment()
      },
      {
        text: this.translate.instant('messages.changeCustomerDescription'),
        handler: () => this.changeCustomerDescription()
      },
      {
        text: this.translate.instant(
          this._product.isFavorite ? 'messages.removeFromFavorites' : 'messages.addToFavorites'),
        role: this.product.isFavorite ? 'destructive' : undefined,
        handler: () => this._product.isFavorite ? this.removeFromFavourites() : this.addToFavourites()
      },
      {
        text: this.translate.instant('cancelButtonText'),
        role: 'cancel',
        handler: () => { }
      }
    ]

    return buttons
  }


  ngOnInit() {
  }

  async load(id: number) {
    try {
      this.loading = true
      this.ref.markForCheck()

      this.departmentsRepo.get(
        this.user.activeUser.userCode).then(x => this.departments = x)

      this._product = await this.repo.getDetail(
        id,
        this.user.activeUser,
        this.culture
      )


      const cart = (this.cart || this.cart.active) ? this.cart.active : null
      if (cart) {
        const pr = cart.products.find(x => x.id === this._product.id)
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
      message: this.translate.instant('messages.copiedToClipboard'),
      duration: 2000
    })
    toast.present()
  }

  isCurrentStack(price: IProductPrice): string {
    let ladderfound = false
    let ladder: IProductPrice

    for (const selectedPrice of this._product.prices) {
      ladderfound = (selectedPrice.quantity <= this._product.amount)
      ladder = selectedPrice
      if (ladderfound === true) { break }
    }

    return (ladderfound && ladder.quantity === price.quantity) ? 'selected-price' : ''
  }

  showAllRecipes() {
    this.recipeCount = 99
  }

  showDocumentActionSheet(doc: any) {
    this.actionSheetCtrl.create({
      buttons: [
        {
          text: this.translate.instant('actions.open'),
          handler: () => {
            window.open(`https://pcm.groupclaes.be/v3/content/file/${doc.guid}?show=true`, '_system', 'location=yes')
          }
        },
        // {
        //   text: this.translate.instant('actions.mail'),
        //   handler: () => {
        //     this.ShowOptionalTextInput(document.guid, 0);
        //   }
        // },
        // {
        //   text: 'Downloaden', /* | translate */
        //   handler: () => { }
        // },
        {
          text: this.translate.instant('cancelButtonText'),
          role: 'cancel',
          handler: () => { }
        }
      ]
    }).then(sheet => sheet.present())
  }
  showRecipeActionSheet(recipe: any) {
    this.actionSheetCtrl.create({
      buttons: [
        {
          text: this.translate.instant('actions.open'),
          handler: () => {
            window.open(`https://pcm.groupclaes.be/v3/content/file/${recipe.guid}?show=true`, '_system', 'location=yes')
          }
        },
        // {
        //   text: this.translate.instant('actions.mail'),
        //   handler: () => this.ShowOptionalTextInput(recipe.guid, 1)
        // },
        {
          text: this.translate.instant('actions.show'),
          handler: () => this.navCtrl.navigateForward('/recipe/recipe-detail', { queryParams: { guid: recipe.guid } })
        },
        {
          text: this.translate.instant('cancelButtonText'),
          role: 'cancel',
          handler: () => { }
        }
      ]
    }).then(sheet => sheet.present())
  }

  openRecipe(recipe: IRecipeModuleEntry) {
    switch (this.culture) {
      case 'fr-BE':
        window.open(`https://recettes.claes-distribution.be/recipe/${recipe.id}/${recipe.name.replace('/ /g', '-')}`,
          '_system', 'location=yes')
        break

      case 'nl-BE':
      default:
        window.open(`https://recepten.claes-distribution.be/recipe/${recipe.id}/${recipe.name.replace('/ /g', '-')}`,
          '_system', 'location=yes')
        break
    }
  }
  showActions() {
    // TODO
  }

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
      if (productAmount > 0 && (productAmount % this._product.stackSize) !== 0) {
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

  openPicturePreview() {
    this.pictureOpen = true;
    console.log('Opened image preview')
  }


  async removeFromDepartment(departmentId: number) {
    if (departmentId != null) {
      await this.products.removeFromDepartment(this.product.id, departmentId)
      this.product.departments = this.product.departments.filter(x => x.id !== departmentId)

      const toast = await this.toastCtrl.create({
        message: 'Het product werd uit de afdeling verwijderd.', /* | translate */
        duration: 3000,
        position: 'top'
      })
      toast.present()

      this.ref.markForCheck()
    } else {
      const toast = await this.toastCtrl.create({
        message: 'Er is geen Geen afdeling geselecteerd.', /* | translate */
        duration: 3000,
        position: 'top'
      })

      toast.present()
    }
  }

  openAddProductToDepartment() {
    this.departmentAddOpen = true
    this.ref.markForCheck()
  }

  async completeAddProductToDepartment() {
    if (this.selectedDepartment) {
      await this.products.addToDepartment(this._product.id, this.selectedDepartment)

      this.selectedDepartment = null
      this.departmentAddOpen = false

      const toast = await this.toastCtrl.create({
        message: 'Het product werd toegevoegd aan de afdeling.', /* | translate */
        duration: 3000,
        position: 'top'
      })

      toast.present()

      await this.load(this.product.id)
    } else {
      const toast = await this.toastCtrl.create({
        message: 'Er is geen Geen afdeling geselecteerd.', /* | translate */
        duration: 3000,
        position: 'top'
      })

      toast.present()
    }
  }

  async addToFavourites() {
    await this.products.addToFavourites(this._product.id)
    this._product.isFavorite = true


    const toast = await this.toastCtrl.create({
      message: 'Het product is toegevoegd aan uw favorieten.', /* | translate */
      duration: 3000,
      position: 'top'
    })

    toast.present()

    this.ref.markForCheck()
  }

  async removeFromFavourites() {
    await this.products.removeFromFavourites(this._product.id)
    this._product.isFavorite = false


    const toast = await this.toastCtrl.create({
      message: 'Het product is verwijderd uit uw favorieten.', /* | translate */
      duration: 3000,
      position: 'top'
    })

    toast.present()

    this.ref.markForCheck()
  }

  async changeCustomerDescription() {
    const prompt = await this.alertCtrl.create({
      header: 'Customer description',
      message: 'Enter the desired description',
      inputs: [
        {
          name: 'description',
          placeholder: 'Persoonlijke omschrijving'
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Save',
          handler: (data: { description: string }) => {
            this.products.changeCustomerDescription(this._product.id, data.description)
              .then(async () => {
                const toast = await this.toastCtrl.create({
                  message: 'De beschrijvving is gewijzigd.', /* | translate */
                  duration: 1500,
                  position: 'top'
                })

                toast.present();
              })
          }
        }
      ]
    })

    prompt.present()
  }

  // private async showOptionalTextInput(guid: string, type: number) {
  //   const textModal = this.modalCtrl.create(MessageInputModalComponent);

  //   switch (type) {
  //     case 0:
  //       textModal.onDidDismiss((result) => {
  //         if (result != null && result.success === true) {
  //           this.mailDatasheet(guid, result.text);
  //         }
  //       });
  //       break;

  //     case 1:
  //       textModal.onDidDismiss((result) => {
  //         if (result != null && result.success === true) {
  //           this.mailRecipe(guid, result.text);
  //         }
  //       });
  //       break;
  //   }

  //   await textModal.present();
  // }
}
