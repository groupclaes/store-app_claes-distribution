import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core'
import { AlertController, LoadingController, NavController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { CartService } from 'src/app/core/cart.service'
import { CustomersRepositoryService } from 'src/app/core/repositories/customers.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { AppCustomerModel, UserService } from 'src/app/core/user.service'
import { SyncService } from 'src/app/core/sync.service'
import { ActivatedRoute } from '@angular/router'
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { LoggerService } from '../../@shared/logging/log.service'

const logger = new LoggerService('CustomersPage')

@Component({
  selector: 'app-customers',
  templateUrl: './customers.page.html',
  styleUrls: ['./customers.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomersPage {
  @ViewChild(CdkVirtualScrollViewport) virtualScroll: CdkVirtualScrollViewport
  _query: string = ''

  private _customers: AppCustomerModel[] = []
  private _loading: HTMLIonLoadingElement
  private _filterTimeout

  constructor(private loadCtrl: LoadingController,
              private alertCtrl: AlertController,
              private navCtrl: NavController,
              private user: UserService,
              private customersService: CustomersRepositoryService,
              private cartService: CartService,
              private settings: SettingsService,
              private ref: ChangeDetectorRef,
              private translate: TranslateService,
              private sync: SyncService,
              private route: ActivatedRoute,
              private cart: CartService) {
  }

  get createCustomerAllowed(): boolean {
    return (this.user.userinfo) ? this.user.userinfo.type === 2 || this.user.userinfo.type === 3 : false
  }

  get customers(): AppCustomerModel[] {
    return this._customers
  }

  get searchTerm(): string {
    return this._query || ''
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.user.userinfo) {
      await this.navCtrl.navigateRoot('/account/login')
    } else if (this.route.snapshot.queryParams.selectedCust != null) {
      await this.followUp(this.route.snapshot.queryParams.selectedCust)
    } else {
      this.loadCustomers().then((): void => this.ref.markForCheck())
    }
  }

  ionViewDidEnter(): void {
    this.ref.markForCheck()
  }

  async loadCustomers(overrideQuery?: string): Promise<void> {
    this._customers = []
    this.ref.markForCheck()

    if (overrideQuery !== undefined)
      this._query = overrideQuery

    const customers = await this.customersService.searchCustomers<any>(this.searchTerm)

    if (customers.length > 0) {
      for (const customer of customers) {
        customer.promo = customer.promo === 1
        customer.fostplus = customer.fostplus === 1
      }
    }
    logger.debug('Received customers', customers.length)

    this._customers = customers
    this.virtualScroll.scrollToIndex(0)
  }

  setActiveCustomer(customer: AppCustomerModel): void {
    if (this.user.hasAgentAccess && this.user.activeUser
      && (this.user.activeUser.id !== customer.id || this.user.activeUser.address !== customer.addressId)) {
      this.alertCtrl.create({
        header: this.translate.instant('customer-info.alerts.switch-customer.title'), /* | translate */
        message: (this.translate.instant('customer-info.alerts.switch-customer.message') as string)
          .replace('{{ACTIVE_CUSTOMER_NAME}}', this.user.activeUser.name)
          .replace('{{ACTIVE_CUSTOMER_CITY}}', this.user.activeUser.city),
        buttons: [
          {
            text: this.translate.instant('no'),
            role: 'cancel',
            handler: () => {
              this.navCtrl.navigateRoot('/notes', { queryParams: { createNote: true, selectedCust: customer } })
              this.ref.markForCheck()
            }
          },
          {
            text: this.translate.instant('yes'),
            handler: () => {
              this.followUp(customer)
              this.ref.markForCheck()
            }
          }
        ]
      }).then(alert => alert.present())
    } else if (this.user.activeUser && this.user.activeUser.id === customer.id && this.user.activeUser.address === customer.addressId) {
      // the new user is the current user, do nothing ...
      this.alertCtrl.create({
        header: this.translate.instant('customer-info.alerts.no-change-customer.title'),
        message: this.translate.instant('customer-info.alerts.no-change-customer.message')
      }).then(alert => alert.present())
    } else {
      this.followUp(customer)
    }
  }

  filterCustomers(event: any): void {
    try {
      window.clearTimeout(this._filterTimeout)
    } finally {
      this._filterTimeout = window.setTimeout(() => this.loadCustomers(event.target?.value).then(_ => this.ref.markForCheck()), 120)
    }
  }

  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async followUp(customer: AppCustomerModel) {
    this._loading = await this.loadCtrl.create({
      spinner: 'lines',
      message: this.translate.instant('preparing') /** | translate */
    })
    await this._loading.present()
      .then(_ => this.ref.markForCheck())

    let skip_prepare = false

    // Set current active customer user
    const new_user = {
      id: customer.id,
      name: customer.name,
      address: customer.addressId,
      addressName: customer.addressName,
      addressGroup: customer.addressGroupId,
      type: customer.userType,
      city: customer.city,
      promo: customer.promo,
      bonus: customer.bonusPercentage,
      fostplus: customer.fostplus,
      userCode: customer.userCode
    }

    try {
      const previous_user = localStorage.getItem('active-user')
      if (previous_user) {
        let _prev = JSON.parse(previous_user)
        skip_prepare = _prev.id === new_user.id && _prev.address === new_user.address
      }
    } catch {

    }
    localStorage.setItem('active-user', JSON.stringify(new_user))
    this.user.activeUser = new_user

    // Set a newly active customer
    await this.cartService.updateActive(customer.id, customer.addressId)

    if (!skip_prepare) {
      await this.sync.prepareCurrentExceptions(customer)
      if (this.user.userinfo.type === 3) { // || this.user.userinfo.type === 2
        logger.debug('Type 3 -- syncing prices and favourites', this.user.userinfo, customer)
        await this.sync.syncPrices(this.user.userinfo.userId, 'all', true, customer.id, customer.addressId)
        await this.sync.syncFavorites(this.user.userinfo.userId, 'all', true, customer.id, customer.addressId)
      }
    }

    const newRoot: string = await this.settings.defaultPage
    await this._loading.dismiss()
    this.ref.markForCheck()

    this.navCtrl.navigateRoot(newRoot)
  }

  get isAgent(): boolean {
    return this.user.hasAgentAccess
  }

  get cartLink(): any[] {
    const params: any[] = ['/carts']
    if (this.cart.active)
      params.push(this.cart.active.id)
    return params
  }
}
