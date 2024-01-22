import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { LoggingProvider } from 'src/app/@shared/logging/log.service';
import { BrowserService } from 'src/app/core/browser.service';
import { CustomersRepositoryService, IAppDeliveryScheduleModel, IContact, IVisitNote }
  from 'src/app/core/repositories/customers.repository.service';
import { AppCustomerModel, Customer, UserService } from 'src/app/core/user.service';
import { Md5 } from 'ts-md5';

@Component({
  selector: 'app-customer-info',
  templateUrl: './customer-info.page.html',
  styleUrls: ['./customer-info.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerInfoPage {
  customer: AppCustomerModel;
  deliverySchedules: IAppDeliveryScheduleModel[];
  contacts: IContact[];

  constructor(private translate: TranslateService,
    private customerService: CustomersRepositoryService,
    private user: UserService,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private ref: ChangeDetectorRef,
    private logger: LoggingProvider,
    private browser: BrowserService) { }


  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }

  get culture(): string {
    return this.translate.currentLang.split('-')[0]
  }

  get displayVat(): string {
    const vatString = `${this.customer.vatNum}`
    if (vatString.length > 2) {
      if (isNaN(+this.customer.vatNum)) {
        return this.customer.vatNum
      }

      const newVat = ('000000000' + vatString)
      return 'BE' + newVat.substring(newVat.length - 10)
    }

    return this.customer.vatNum
  }

  ionViewWillEnter() {
    if (!this.user.userinfo) {
      this.navCtrl.navigateRoot('/account/login')
    } else {
      this.loadCustomerInfo()
      this.ref.markForCheck()
    }
  }

  async loadCustomerInfo() {
    if (this.user.activeUser) {
      const result = await this.customerService
        .get<AppCustomerModel>(this.user.activeUser.id,
          this.user.activeUser.address)

      if (result != null) {
        this.customer = result
        await Promise.all([
          this.loadDeliverySchedules(),
          this.loadContacts()
        ])
        this.logger.debug('Fetched notes, deliveryschedules and contacts')
        this.ref.markForCheck();
      }
      else {
        const alert = await this.alertCtrl.create({
          message: this.translate.instant('customer-info.alerts.invalid-customer.message'),
          header: this.translate.instant('customer-info.alerts.invalid-customer.title'),
          buttons: [
            {
              text: this.translate.instant('customer-info.alerts.invalid-customer.buttons.cancel'),
              role: 'cancel'
            }
          ]
        })
        alert.present();
      }
    }
  }

  async loadDeliverySchedules() {
    this.logger.debug('Fetching delivery schedules')
    const deliverySchedules = await this.customerService.getDeliverySchedule(
      this.user.activeUser.id,
      this.user.activeUser.address)

    this.deliverySchedules = deliverySchedules
    this.logger.debug('Received delivery schedules', deliverySchedules)
  }

  async loadContacts() {
    this.logger.debug('loading contacts')

    const contacts = await this.customerService.getContacts(
      this.user.activeUser.id,
      this.user.activeUser.address)

    for (const contact of contacts) {
      contact.name = contact.name.split(`''`).join(`'`);
      contact.firstName = contact.firstName.split(`''`).join(`'`);
      contact.avatar = `https://www.gravatar.com/avatar/${new Md5().appendStr(contact.mailAddress).end().toString()}?s=140&d=identicon`
    }

    this.contacts = contacts;
  }

  goToMail(mail: string) {
    return this.openBrowserUrl('mailto:' + mail)
  }

  goToPhone(phone: string) {
    return this.openBrowserUrl('tel:' + phone.replace('+32', '')
      .replace('(0)', '0')
      .replace(' ', '')
      .replace('-', ''))
  }

  private openBrowserUrl(url: string) {
    return this.browser.open(url, '_system', 'hidden=yes,location=yes')
  }
}
