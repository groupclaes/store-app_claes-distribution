import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NavController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { LoggingProvider } from 'src/app/@shared/logging/log.service';
import { ApiService } from 'src/app/core/api.service';
import { UserService } from 'src/app/core/user.service';

const _deliveryHours = [
  '06:00',
  '06:30',
  '07:00',
  '07:30',
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00'
]

@Component({
  selector: 'app-customer-create',
  templateUrl: './customer-create.page.html',
  styleUrls: ['./customer-create.page.scss'],
})
export class CustomerCreatePage {
  newCustomerForm: FormGroup;

  constructor(
    private user: UserService,
    private navCtrl: NavController,
    private formBuilder: FormBuilder,
    private api: ApiService,
    private logger: LoggingProvider,
    private ref: ChangeDetectorRef
  ) { }

  get deliveryHours(): string[] {
    // Use a static delivery hours array to improve ref update performance
    return _deliveryHours
  }
  ionViewWillEnter() {
    if (!this.user.userinfo) {
      this.navCtrl.navigateRoot('/account/login')
    }
  }

  ionViewDidEnter() {
    if (this.user.userinfo) {
      this.newCustomerForm = this.formBuilder.group({
        weekNr: [''],
        dayNr: [''],
        customerName: [],
        customerBrandName: [],
        customerClassification: [''],
        customerCommercialForm: [],
        customerContact: [],
        customerStreetName: [],
        customerStreetNumber: [],
        customerZipCode: [],
        customerCity: [],
        customerCountry: ['be'],
        customerEmail: [],
        customerTel: [],
        customerFax: [],
        customerLanguage: ['nl'],
        customerVat: [],
        customerBank: [],
        customerContactFoodsafety: [],
        customerNr: [],
        customerType: [],
        customerOrganisation: [],
        deliverFromMonday1: [''],
        deliverTillMonday1: [''],
        deliverFromMonday2: [''],
        deliverTillMonday2: [''],
        deliverFromTuesday1: [''],
        deliverTillTuesday1: [''],
        deliverFromTuesday2: [''],
        deliverTillTuesday2: [''],
        deliverFromWednesday1: [''],
        deliverTillWednesday1: [''],
        deliverFromWednesday2: [''],
        deliverTillWednesday2: [''],
        deliverFromThursday1: [''],
        deliverTillThursday1: [''],
        deliverFromThursday2: [''],
        deliverTillThursday2: [''],
        deliverFromFriday1: [''],
        deliverTillFriday1: [''],
        deliverFromFriday2: [''],
        deliverTillFriday2: [''],
        addressDefault: [false],
        addressName: [],
        addressClassification: [''],
        addressStreetName: [],
        addressStreetNumber: [],
        addressZipCode: [],
        addressCity: [],
        addressCountry: ['be'],
        addressEmail: [],
        addressTel: [],
        addressFax: [],
        addressLanguage: ['nl'],
        addressDeliverFromMonday1: [''],
        addressDeliverTillMonday1: [''],
        addressDeliverFromMonday2: [''],
        addressDeliverTillMonday2: [''],
        addressDeliverFromTuesday1: [''],
        addressDeliverTillTuesday1: [''],
        addressDeliverFromTuesday2: [''],
        addressDeliverTillTuesday2: [''],
        addressDeliverFromWednesday1: [''],
        addressDeliverTillWednesday1: [''],
        addressDeliverFromWednesday2: [''],
        addressDeliverTillWednesday2: [''],
        addressDeliverFromThursday1: [''],
        addressDeliverTillThursday1: [''],
        addressDeliverFromThursday2: [''],
        addressDeliverTillThursday2: [''],
        addressDeliverFromFriday1: [''],
        addressDeliverTillFriday1: [''],
        addressDeliverFromFriday2: [''],
        addressDeliverTillFriday2: [''],
        remarks: ['']
      })

      this.ref.markForCheck()
    }
  }

  /**
   * Send a customer create request to the backend
   */
  async doCreateCustomer() {
    const form: $TSFixMe = this.newCustomerForm.value
    try {
      const result = await firstValueFrom(
        this.api.post('app/customers', form, {
          usercode: this.user.userinfo.userCode,
          username: this.user.credential.username
        }))

      if (result != null) {
        this.ref.markForCheck()
        this.navCtrl.pop()
        return
      } else {
        // this.logger.error(result)
      }
    } catch(err) {
      this.logger.error(err)
    }
  }
}
