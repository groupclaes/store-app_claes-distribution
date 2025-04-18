import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { ActivatedRoute, Params } from '@angular/router'
import { ActionSheetController, AlertController, ModalController, NavController, ToastController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { firstValueFrom } from 'rxjs'
import { LoggerService } from 'src/app/@shared/logging/log.service'
import { NetworkService } from 'src/app/@shared/network.service'
import { ApiService } from 'src/app/core/api.service'
import { BrowserService } from 'src/app/core/browser.service'
import { CartService } from 'src/app/core/cart.service'
import {
  OptionalInputModalComponent
} from 'src/app/core/components/optional-input-modal/optional-input-modal.component'
import { ProductsService } from 'src/app/core/products.service'
import { DepartmentsRepositoryService, IDepartmentT } from 'src/app/core/repositories/departments.repository.service'
import {
  IPCMAttachmentEntry,
  IProductDetailT,
  IProductPrice,
  IRecipeModuleEntry,
  ProductsRepositoryService
} from 'src/app/core/repositories/products.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { UserService } from 'src/app/core/user.service'
import { environment } from 'src/environments/environment'
import { Share, ShareOptions, ShareResult } from '@capacitor/share'
import { Directory, DownloadFileResult, Filesystem, GetUriResult } from '@capacitor/filesystem'
import { FileOpener } from '@capacitor-community/file-opener'

const UNAVAILABLE_AFTER = new Date('2050-12-31')
const logger = new LoggerService('ProductDetailPage')

// Item numbers for testing
// url in description: 1502024166

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailPage {
  loading: boolean = true
  recipeCount: number = 5
  recipeModuleCount: number = 5
  showContentUnit: boolean = false
  displayThumbnail: boolean
  pictureOpen: boolean = false

  departmentAddOpen: boolean = false
  selectedDepartment: number = null
  departments: IDepartmentT[]

  _product: IProductDetailT
  recipes: IPCMAttachmentEntry[] = []
  recipesModule: IRecipeModuleEntry[] = []
  datasheets: IPCMAttachmentEntry[] = []
  usageManuals: IPCMAttachmentEntry[] = []

  constructor(
    private api: ApiService,
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private repo: ProductsRepositoryService,
    private products: ProductsService,
    private cart: CartService,
    private departmentsRepo: DepartmentsRepositoryService,
    private sanitizer: DomSanitizer,
    public user: UserService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    public modalCtrl: ModalController,
    private navCtrl: NavController,
    settings: SettingsService,
    route: ActivatedRoute,
    private actionSheetCtrl: ActionSheetController,
    private browser: BrowserService,
    public network: NetworkService
  ) {
    logger.debug('ProductDetailPage -- constructor()')
    settings.showThumbnail.then((value: boolean): void => {
      this.displayThumbnail = value
      this.ref.markForCheck()
    })
    route.params.subscribe(async (params: Params): Promise<void> => {
      if (+params.id) {
        await this.load(+params.id)
      }
    })
    this.network.connected.subscribe((): void => this.ref.markForCheck())
  }

  get canPromo(): boolean {
    return this.user.activeUser?.promo == true
  }

  get isGuest(): boolean {
    return this.user.isGuest
  }

  get productName(): string {
    if (this._product) {
      return `${this._product.name}`
    }
    return ''
  }

  get amountLabel(): string {
    return this.translate.instant('amount') + ` (${this._product?.unit})`
  }

  get productImage(): string {
    if (this._product) {
      return this._product.url.replace('?s=thumb', '')
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
    if (this.cart.active) {
      params.push(this.cart.active.id)
    }
    return params
  }

  get actionSheetButtons(): any[] {
    let buttons: Array<any> = [
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
        handler: () => {
        }
      }
    ]

    if (this.departments?.length > 0) {
      buttons = [
        {
          text: this.translate.instant('messages.addToDepartment'),
          handler: () => this.openAddProductToDepartment()
        },
        ...buttons
      ]
    }

    return buttons
  }

  get otherUnits(): any[] | undefined {
    if (this._product && this._product['units']) {
      return this._product['units']
    }
    return undefined
  }

  async load(id: number): Promise<void> {
    try {
      this.loading = true
      this.ref.markForCheck()

      if (!this.user.isGuest)
        this.departmentsRepo.get(this.user.activeUser.userCode).then(x => this.departments = x)
      else
        this.departments = []

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
      logger.error(err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }

    if (!this.user.isGuest)
      await this.getAttachments()
  }

  async getAttachments(): Promise<void> {
    try {
      const res = await this.repo.getAttachments(this._product.id, this._product.itemnum, this.culture)
      if (res) {
        this.datasheets = res.datasheets
        this.recipes = res.recipes
        this.recipesModule = res.recipesModule
        this.usageManuals = res.usageManuals

        for (let item of this.datasheets) {
          await this.checkDocumentAvailable(item, 'datasheets')
        }
        for (let item of this.recipes) {
          await this.checkDocumentAvailable(item, 'recipes')
        }
        for (let item of this.usageManuals) {
          await this.checkDocumentAvailable(item, 'usage-manuals')
        }
      }
    } catch (err) {
      logger.error(err)
    } finally {
      this.ref.markForCheck()
    }
  }

  async checkDocumentAvailable(item: IPCMAttachmentEntry, path: string) {
    try {
      await Filesystem.stat({
        path: `${path}/${item.guid}/${item.name}`,
        directory: Directory.Cache
      })
      item['available'] = true
    } catch {
      item['available'] = false
    } finally {
      this.ref.markForCheck()
    }
  }

  setAmount(amount: number): void {
    if (!this._product.availableOn) {
      this._product.amount = amount
      this.changeProductAmount()
      this.ref.markForCheck()
    } else {
      alert(this.translate.instant('productUnavailable'))
    }
  }

  async copyMessage(val: string): Promise<void> {
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
      if (ladderfound === true) {
        break
      }
    }

    return (ladderfound && ladder.quantity === price.quantity) ? 'selected-price' : ''
  }

  showAllRecipes(): void {
    this.recipeCount = 99
  }

  showAllRecipesModule(): void {
    this.recipeModuleCount = 999
  }

  async openAttachment(attachment: IPCMAttachmentEntry, path: string): Promise<void> {
    // check if file is available in cache
    let uri: string
    try {
      this.ref.markForCheck()

      const res: GetUriResult = await Filesystem.stat({
        path: `${path}/${attachment.guid}/${attachment.name}`,
        directory: Directory.Cache
      })
      uri = res.uri
    } catch {
      if (!this.network.online)
        return this.network.noop()
      attachment['available'] = undefined
      this.ref.markForCheck()
      await Filesystem.downloadFile({
        url: `${environment.pcm_url}/content/file/${attachment.guid}?show=true`,
        directory: Directory.Cache,
        path: `${path}/${attachment.guid}/${attachment.name}`,
        recursive: true
      }).then((res: DownloadFileResult): string => uri = res.path)
      this.ref.markForCheck()
    } finally {
      if (uri) {
        attachment['available'] = true
        this.ref.markForCheck()
        try {
          await FileOpener.open({
            filePath: uri,
            openWithDefault: true,
            contentType: 'application/pdf'
          })
        } catch {
          this.navCtrl.navigateForward(['documents', path, attachment.guid, attachment.name], { animated: true })
        }
      } else {
        attachment['available'] = false
        this.ref.markForCheck()
      }
    }
  }

  showDocumentActionSheet(doc: any): void {
    this.actionSheetCtrl.create({
      buttons: [
        {
          text: this.translate.instant('actions.open'),
          handler: () => {
            this.browser.open(`https://pcm.groupclaes.be/v4/content/file/${doc.guid}?show=true`, '_system', 'location=yes')
          }
        },
        {
          text: this.translate.instant('actions.mail'),
          handler: () => {
            this.showMailTextInput(doc.guid, 0)
          }
        },
        // {
        //   text: 'Downloaden', /* | translate */
        //   handler: () => { }
        // },
        {
          text: this.translate.instant('cancelButtonText'),
          role: 'cancel',
          handler: () => {
          }
        }
      ]
    }).then(sheet => sheet.present())
  }

  showRecipeActionSheet(recipe: any): void {
    this.actionSheetCtrl.create({
      buttons: [
        {
          text: this.translate.instant('actions.open'),
          handler: (): void => {
            this.browser.open(`https://pcm.groupclaes.be/v4/content/file/${recipe.guid}?show=true`, '_system', 'location=yes')
          }
        },
        {
          text: this.translate.instant('actions.mail'),
          handler: (): Promise<void> => this.showMailTextInput(recipe.guid, 1)
        },
        // {
        //   text: this.translate.instant('actions.show'),
        //   handler: () => this.navCtrl.navigateForward('/recipe/recipe-detail', { queryParams: { guid: recipe.guid } })
        // },
        {
          text: this.translate.instant('cancelButtonText'),
          role: 'cancel',
          handler: (): void => {
          }
        }
      ]
    }).then(sheet => sheet.present())
  }

  safe(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html.trim())
  }

  async changeProductAmount(): Promise<void> {
    const productId = this._product.id
    let productAmount = this._product.amount || -1
    let showAlert = false
    this.ref.markForCheck()

    const customerId = this.user.activeUser.id
    const addressId = this.user.activeUser.address
    const credential = this.user.credential

    // check if item had minorderQuantity
    if (this._product.minOrder > 1) {
      logger.info('this product has a minOrderquantity')
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

    this.cart.setProduct(productId, productAmount, customerId, addressId, credential)
    this.ref.markForCheck()
  }

  openPicturePreview(): void {
    this.pictureOpen = true
  }

  share(options: ShareOptions): Promise<ShareResult> {
    return Share.share(options)
  }

  async shareLargeImage(): Promise<void> {
    await this.share({
      title: 'Product foto ' + this._product.name,
      // text: 'Orig',
      url: this._product.url.replace('?s=thumb', '?s=source')
    })
  }

  async removeFromDepartment(departmentId: number): Promise<void> {
    if (departmentId != null) {
      const departmentAlias = this.product.departments.find(x => x.id === departmentId).alias
      const message: string = (this.translate.instant('pages.product-detail.modals.remove-department.title') as string)
        .replace('{{PRODUCT}}', this.product.name)
        .replace('{{DEPARTMENT}}', departmentAlias)

      const alert = await this.alertCtrl.create({
        message,
        buttons: [
          {
            text: this.translate.instant('pages.product-detail.modals.remove-department.cancel'),
            role: 'cancel'
          },
          {
            text: this.translate.instant('pages.product-detail.modals.remove-department.confirm'),
            handler: async () => {
              await this.products.removeFromDepartment(this.product.id, departmentId)
              this.product.departments = this.product.departments.filter(x => x.id !== departmentId)

              const toast = await this.toastCtrl.create({
                message: (this.translate.instant('pages.product-detail.modals.remove-department.removed') as string)
                  .replace('{{PRODUCT}}', this.product.name)
                  .replace('{{DEPARTMENT}}', departmentAlias), /* | translate */
                duration: 3000,
                position: 'top'
              })
              toast.present()

              this.ref.markForCheck()
            }
          }
        ]
      })

      await alert.present()
    } else {
      const toast = await this.toastCtrl.create({
        message: 'Er is geen Geen afdeling geselecteerd.', /* | translate */
        duration: 3000,
        position: 'top'
      })

      toast.present()
    }
  }

  openAddProductToDepartment(): void {
    this.departmentAddOpen = true
    this.ref.markForCheck()
  }

  async completeAddProductToDepartment(): Promise<void> {
    if (this.selectedDepartment) {
      await this.products.addToDepartment(this._product.id, this.selectedDepartment)

      this.selectedDepartment = null
      this.departmentAddOpen = false

      const toast: HTMLIonToastElement = await this.toastCtrl.create({
        message: 'Het product werd toegevoegd aan de afdeling.', /* | translate */
        duration: 3000,
        position: 'top'
      })

      await toast.present()

      await this.load(this.product.id)
    } else {
      const toast: HTMLIonToastElement = await this.toastCtrl.create({
        message: 'Er is geen Geen afdeling geselecteerd.', /* | translate */
        duration: 3000,
        position: 'top'
      })

      await toast.present()
    }
  }

  async addToFavourites(): Promise<void> {
    await this.products.addToFavourites(this._product.id)
    this._product.isFavorite = true

    const toast: HTMLIonToastElement = await this.toastCtrl.create({
      message: 'Het product is toegevoegd aan uw favorieten.', /* | translate */
      duration: 3000,
      position: 'top'
    })
    await toast.present()

    this.ref.markForCheck()
  }

  async removeFromFavourites(): Promise<void> {
    const alert: HTMLIonAlertElement = await this.alertCtrl.create({
      message: (this.translate.instant('pages.product-detail.modals.remove-favourite.title') as string)
        .replace('{{PRODUCT}}', this.product.name),
      buttons: [
        {
          text: this.translate.instant('pages.product-detail.modals.remove-favourite.cancel'),
          role: 'cancel'
        },
        {
          text: this.translate.instant('pages.product-detail.modals.remove-favourite.confirm'),
          handler: async (): Promise<void> => {
            await this.products.removeFromFavourites(this._product.id)
            this._product.isFavorite = false

            const toast: HTMLIonToastElement = await this.toastCtrl.create({
              message: (this.translate.instant('pages.product-detail.modals.remove-favourite.removed') as string)
                .replace('{{PRODUCT}}', this.product.name), /* | translate */
              duration: 3000,
              position: 'top'
            })

            await toast.present()
            this.ref.markForCheck()
          }
        }
      ]
    })

    await alert.present()
  }

  async changeCustomerDescription(): Promise<void> {
    const prompt: HTMLIonAlertElement = await this.alertCtrl.create({
      header: 'Customer description',
      message: 'Enter the desired description',
      inputs: [
        {
          name: 'description',
          placeholder: 'Persoonlijke omschrijving'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Save',
          handler: (data: { description: string }): void => {
            this.products.changeCustomerDescription(this._product.id, data.description)
              .then(async (): Promise<void> => {
                const toast: HTMLIonToastElement = await this.toastCtrl.create({
                  message: 'De beschrijvving is gewijzigd.', /* | translate */
                  duration: 1500,
                  position: 'top'
                })

                await toast.present()
              })
          }
        }
      ]
    })

    await prompt.present()
  }

  async mailRecipe(guid: string, text: string): Promise<void> {
    try {
      const apiResult: any = await firstValueFrom(
        this.api.post(`app/recipes/mail/${guid}`, this.user.credential, {
          customer: this.user.activeUser.id,
          address: this.user.activeUser.address,
          message: text,
          culture: this.culture,
          test: environment.production ? undefined : true
        }))
      if (apiResult) {
        this.alertCtrl.create({
          header: this.translate.instant('recipeMailSend'),
          message: this.translate.instant('recipeMailMessageSend')
        }).then((alert: HTMLIonAlertElement): Promise<void> => alert.present())
        return
      }
    } catch (err) {
    }

    this.alertCtrl.create({
      header: this.translate.instant('recipeMailError'),
      message: this.translate.instant('recipeMailMessageError')
    }).then((alert: HTMLIonAlertElement): Promise<void> => alert.present())
  }

  async mailDatasheet(guid: string, text: string): Promise<void> {
    try {
      const apiResult: any = await firstValueFrom(
        this.api.post(`app/datasheets/mail/${guid}`, this.user.credential, {
          customer: this.user.activeUser.id,
          address: this.user.activeUser.address,
          message: text,
          culture: this.culture
        }))
      if (apiResult) {
        this.alertCtrl.create({
          header: this.translate.instant('datasheetMailSend'),
          message: this.translate.instant('datasheetMailMessageSend')
        }).then((alert: HTMLIonAlertElement): Promise<void> => alert.present())
        return
      }
    } catch (err) {
    }

    this.alertCtrl.create({
      header: this.translate.instant('datasheetMailError'),
      message: this.translate.instant('datasheetMailMessageError')
    }).then((alert: HTMLIonAlertElement): Promise<void> => alert.present())
  }

  private async showMailTextInput(guid: string, type: number): Promise<void> {
    const textModal: HTMLIonModalElement = await this.modalCtrl.create({
      component: OptionalInputModalComponent,
      componentProps: {
        title: this.translate.instant('pages.product-detail.modals.mail.title'),
        cancelButton: this.translate.instant('pages.product-detail.modals.mail.cancel'),
        confirmButton: this.translate.instant('pages.product-detail.modals.mail.confirm'),
        label: this.translate.instant('pages.product-detail.modals.mail.title'),
        placeholder: this.translate.instant('pages.product-detail.modals.mail.placeholder')
      }
    })

    await textModal.present()

    const { data, role } = await textModal.onWillDismiss()

    if (role === 'confirm') {
      switch (type) {
        case 0:
          return await this.mailDatasheet(guid, data)

        case 1:
          return await this.mailRecipe(guid, data)
      }
    }
  }
}
