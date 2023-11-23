import { firstValueFrom } from 'rxjs';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { CartService } from 'src/app/core/cart.service';
import { CustomersRepositoryService, IVisitNote } from 'src/app/core/repositories/customers.repository.service';
import { SettingsService } from 'src/app/core/settings.service';
import { AppCustomerModel, UserService } from 'src/app/core/user.service';
import { SyncService } from 'src/app/core/sync.service';
import { ActivatedRoute } from '@angular/router';
import { StorageProvider } from 'src/app/core/storage-provider.service';
import { LoggingProvider } from 'src/app/@shared/logging/log.service';

export const LS_SAVED_NOTES = 'saved_notes';

@Component({
  selector: 'app-customers',
  templateUrl: './customers.page.html',
  styleUrls: ['./customers.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomersPage {
  _query = '';

  private _customers: AppCustomerModel[] = [];
  private _loading: HTMLIonLoadingElement
  private _filterTimeout;

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
    private storage: StorageProvider,
    private route: ActivatedRoute,
    private logger: LoggingProvider) { }

  get createCustomerAllowed(): boolean {
    return (this.user.userinfo) ? this.user.userinfo.type === 2 || this.user.userinfo.type === 3 : false;
  }

  get customers(): AppCustomerModel[] {
    return this._customers;
  }

  get searchTerm(): string {
    return this._query || '';
  }

  ionViewWillEnter() {
    if (!this.user.userinfo) {
      this.navCtrl.navigateRoot('/account/login')
    } else {
      if (this.route.snapshot.params.selectedCust != null) {
        this.followUp(this.route.snapshot.params.selectedCust)
      } else {
        this.loadCustomers().then(x => this.ref.markForCheck())
      }
    }
  }

  async loadCustomers(overrideQuery?: string) {
    this._customers = []
    this.ref.markForCheck()

    if (overrideQuery !== undefined) {
      this._query = overrideQuery
    }

    const customers = await this.customersService.searchCustomers<any>(this.searchTerm)

    if (customers.length > 0) {
      for (const customer of customers) {
        customer.promo = customer.promo === 1
        customer.fostplus = customer.fostplus === 1
      }
    }
    this.logger.debug('Received customers', customers.length)

    this._customers = customers
  }

  setActiveCustomer(customer: AppCustomerModel) {
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
              this.navCtrl.navigateRoot('/notes')
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

  filterCustomers(event: any) {
    try {
      window.clearTimeout(this._filterTimeout);
    } catch (ex) {}

    this._filterTimeout = window.setTimeout(
      () => this.loadCustomers(event.target?.value).then(_ => this.ref.markForCheck()),
      120);
  }

  hasUnsavedNotes(user: AppCustomerModel): boolean {
    const notes: IVisitNote[] = this.storage.get(LS_SAVED_NOTES);

    if (!notes || notes.length < 1 || !user) {
      return false;
    }

    return notes.filter(x => x.customer === user.id
        && x.address === user.addressId).length > 0;
  }

  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async followUp(customer: AppCustomerModel) {
    this._loading = await this.loadCtrl.create({
      spinner: 'circular',
      message: this.translate.instant('preparing') /** | translate */
    });
    await this._loading.present()
      .then(_ => this.ref.markForCheck())

    // Set current active customer user
    this.user.activeUser = {
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

    // Set a newly active customer
    await this.cartService.updateActive(customer.id, customer.addressId)

    await this.sync.prepareCurrentExceptions(customer)
    if (this.user.userinfo.type === 3 || this.user.userinfo.type === 2) {
      this.logger.debug('Type 3 -- syncing prices and favourites', customer)
      await this.sync.syncPrices(this.user.credential, 'all', true, customer.id, customer.addressId)
      await this.sync.syncFavorites(this.user.credential, 'all', true, customer.id, customer.addressId)
    }



    const newRoot = await firstValueFrom(this.settings.DisplayDefaultPage)
    await this._loading.dismiss()
    this.ref.markForCheck()

    this.navCtrl.navigateRoot(newRoot)
  }
}
