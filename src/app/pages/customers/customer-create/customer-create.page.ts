import { ChangeDetectorRef, Component } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { NavController } from '@ionic/angular'
import { firstValueFrom } from 'rxjs'
import { ApiService } from 'src/app/core/api.service'
import { UserService } from 'src/app/core/user.service'
import { environment } from '../../../../environments/environment'

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
  styleUrls: ['./customer-create.page.scss']
})
export class CustomerCreatePage {
  currentSegment: string = 'invoicing'
  newCustomerForm: FormGroup

  constructor(
    private user: UserService,
    private navCtrl: NavController,
    private formBuilder: FormBuilder,
    private api: ApiService,
    private ref: ChangeDetectorRef
  ) {
  }

  get deliveryHours(): string[] {
    // Use a static delivery hours array to improve ref update performance
    return _deliveryHours
  }

  ionViewWillEnter() {
    if (!this.user.userinfo) {
      this.navCtrl.navigateRoot('/account/login')
    }
  }

  logTime() {
    console.log(this.newCustomerForm.value)
  }

  ionViewDidEnter() {
    let date = new Date(2025, 0, 1, 0, 0)
    var userTimezoneOffset = date.getTimezoneOffset() * -60000
    new Date(date.getTime() + userTimezoneOffset)
    const zeroTime = new Date(date.getTime() + userTimezoneOffset).toISOString().replace('Z', '')

    if (this.user.userinfo) {
      this.newCustomerForm = this.formBuilder.group({
        visitEnabled: [true],
        weekNr: [undefined, [Validators.required]],
        dayNr: [undefined, [Validators.required]],
        customerName: [undefined, [Validators.required, Validators.minLength(2)]],
        customerBrandName: [undefined, [Validators.required]],
        customerClassification: [undefined, [Validators.required]],
        customerCommercialForm: [undefined, [Validators.required]],
        customerStreetName: [undefined, [Validators.required]],
        customerStreetNumber: [undefined, [Validators.required]],
        customerZipCode: [undefined, [Validators.required]],
        customerCity: [undefined, [Validators.required]],
        customerCountry: ['be', [Validators.required]],
        customerEmail: [undefined, [Validators.required, Validators.email]],
        customerTel: [undefined, [Validators.required]],
        customerLanguage: ['nl', [Validators.required]],
        customerVat: [undefined, [Validators.required, Validators.pattern('^((AT)?U[0-9]{8}|(BE)?0[0-9]{9}|(BG)?[0-9]{9,10}|(CY)?[0-9]{8}L|(CZ)?[0-9]{8,10}|(DE)?[0-9]{9}|(DK)?[0-9]{8}|(EE)?[0-9]{9}|(EL|GR)?[0-9]{9}|(ES)?[0-9A-Z][0-9]{7}[0-9A-Z]|(FI)?[0-9]{8}|(FR)?[0-9A-Z]{2}[0-9]{9}|(GB)?([0-9]{9}([0-9]{3})?|[A-Z]{2}[0-9]{3})|(HU)?[0-9]{8}|(IE)?[0-9]S[0-9]{5}L|(IT)?[0-9]{11}|(LT)?([0-9]{9}|[0-9]{12})|(LU)?[0-9]{8}|(LV)?[0-9]{11}|(MT)?[0-9]{8}|(NL)?[0-9]{9}B[0-9]{2}|(PL)?[0-9]{10}|(PT)?[0-9]{9}|(RO)?[0-9]{2,10}|(SE)?[0-9]{12}|(SI)?[0-9]{8}|(SK)?[0-9]{10})$')]],
        customerBank: [undefined, [Validators.required]],
        customerType: [undefined, [Validators.required]],
        customerOrganisation: [undefined, [Validators.required]],
        contactName: [undefined, [Validators.required]],
        contactFoodSafety: [undefined],
        contactPhone: [undefined],
        moAMfr: [zeroTime],
        moAMto: [zeroTime],
        moPMfr: [zeroTime],
        moPMto: [zeroTime],
        tuAMfr: [zeroTime],
        tuAMto: [zeroTime],
        tuPMfr: [zeroTime],
        tuPMto: [zeroTime],
        weAMfr: [zeroTime],
        weAMto: [zeroTime],
        wePMfr: [zeroTime],
        wePMto: [zeroTime],
        thAMfr: [zeroTime],
        thAMto: [zeroTime],
        thPMfr: [zeroTime],
        thPMto: [zeroTime],
        frAMfr: [zeroTime],
        frAMto: [zeroTime],
        frPMfr: [zeroTime],
        frPMto: [zeroTime],
        addressDefault: [false],
        addressName: [undefined, []],
        addressClassification: [undefined, []],
        addressStreetName: [undefined, []],
        addressStreetNumber: [undefined, []],
        addressZipCode: [undefined, []],
        addressCity: [undefined, []],
        addressCountry: ['be', []],
        addressEmail: [undefined, [Validators.email]],
        addressTel: [undefined, []],
        addressLanguage: ['nl', []],
        remarks: ['']
      })

      if (!environment.production) {
        this.newCustomerForm.get('weekNr').removeValidators([Validators.required])
        this.newCustomerForm.get('dayNr').removeValidators([Validators.required])
        this.newCustomerForm.get('visitEnabled').setValue(false)
        this.newCustomerForm.get('customerName').setValue('Jammert')
        this.newCustomerForm.get('customerBrandName').setValue('Vangeysel nv')
        this.newCustomerForm.get('customerClassification').setValue('aa')
        this.newCustomerForm.get('customerCommercialForm').setValue('nv')
        this.newCustomerForm.get('customerStreetName').setValue('Steenberg')
        this.newCustomerForm.get('customerStreetNumber').setValue('32')
        this.newCustomerForm.get('customerZipCode').setValue('3500')
        this.newCustomerForm.get('customerCity').setValue('Hasselt')
        this.newCustomerForm.get('customerCountry').setValue('be')
        this.newCustomerForm.get('customerEmail').setValue('vangeysel-jamie@hotmail.com')
        this.newCustomerForm.get('customerTel').setValue('+32456618771')
        this.newCustomerForm.get('customerLanguage').setValue('nl')
        this.newCustomerForm.get('customerVat').setValue('BE0123456789')
        this.newCustomerForm.get('customerBank').setValue('BE11735099999999')
        this.newCustomerForm.get('customerType').setValue('Grote man')
        this.newCustomerForm.get('customerOrganisation').setValue('WWLF')
        this.newCustomerForm.get('contactName').setValue('Jamie V')
        this.newCustomerForm.get('remarks').setValue('Jamie')
      }

      this.ref.markForCheck()
    }
  }

  onChangeVisitEnabled() {
    // Mark the control as touched to trigger the error message
    // without requiring the toggle to be blurred first
    this.newCustomerForm.get('visitEnabled')!.markAsTouched()

    // when visit is enabled, day and week fields become required
    if (this.newCustomerForm.get('visitEnabled').value) {
      this.newCustomerForm.get('weekNr').addValidators([Validators.required])
      this.newCustomerForm.get('dayNr').addValidators([Validators.required])
    } else {
      this.newCustomerForm.get('weekNr').removeValidators([Validators.required])
      this.newCustomerForm.get('dayNr').removeValidators([Validators.required])
    }
  }

  onChangeAddressDefault(): void {
    // when address default is enabled, all subvalues on tab address become required and if classification is
    // not set it is copied from customer
    if (this.newCustomerForm.get('addressDefault').value) {
      if (!this.newCustomerForm.get('addressClassification').value && this.newCustomerForm.get('customerClassification').value) {
        this.newCustomerForm.get('addressClassification').setValue(this.newCustomerForm.get('customerClassification').value)
      }
      this.newCustomerForm.get('addressName').addValidators([Validators.required])
      this.newCustomerForm.get('addressClassification').addValidators([Validators.required])
      this.newCustomerForm.get('addressStreetName').addValidators([Validators.required])
      this.newCustomerForm.get('addressStreetNumber').addValidators([Validators.required])
      this.newCustomerForm.get('addressZipCode').addValidators([Validators.required])
      this.newCustomerForm.get('addressCity').addValidators([Validators.required])
      this.newCustomerForm.get('addressCountry').addValidators([Validators.required])
      this.newCustomerForm.get('addressEmail').addValidators([Validators.required])
      this.newCustomerForm.get('addressTel').addValidators([Validators.required])
      this.newCustomerForm.get('addressLanguage').addValidators([Validators.required])
    } else {
      this.newCustomerForm.get('addressName').removeValidators([Validators.required])
      this.newCustomerForm.get('addressClassification').removeValidators([Validators.required])
      this.newCustomerForm.get('addressStreetName').removeValidators([Validators.required])
      this.newCustomerForm.get('addressStreetNumber').removeValidators([Validators.required])
      this.newCustomerForm.get('addressZipCode').removeValidators([Validators.required])
      this.newCustomerForm.get('addressCity').removeValidators([Validators.required])
      this.newCustomerForm.get('addressCountry').removeValidators([Validators.required])
      this.newCustomerForm.get('addressEmail').removeValidators([Validators.required])
      this.newCustomerForm.get('addressTel').removeValidators([Validators.required])
      this.newCustomerForm.get('addressLanguage').removeValidators([Validators.required])
    }
  }

  updateSegment($event: any) {
    this.currentSegment = $event.target.value
  }

  validateOpeningHours(form: any) {
    // check that minimum 2 days are filled in and from time is greater than till time

    const keys = [
      'moAMfr',
      'moAMto',
      'moPMfr',
      'moPMto',
      'tuAMfr',
      'tuAMto',
      'tuPMfr',
      'tuPMto',
      'weAMfr',
      'weAMto',
      'wePMfr',
      'wePMto',
      'thAMfr',
      'thAMto',
      'thPMfr',
      'thPMto',
      'frAMfr',
      'frAMto',
      'frPMfr',
      'frPMto'
    ]

    let correctTimes = 0

    for (const timeKey of keys) {
      form[timeKey] = form[timeKey].substring(11, 16)
      if (form[timeKey] === '00:00') {
        form[timeKey] = 'Gesloten'
      } else {
        correctTimes++
      }
    }

    if (correctTimes < 4) {
      throw new Error('Minstens 2 openingsuren toevoegen!')
    }
  }

  /**
   * Send a customer create request to the backend
   */
  async doCreateCustomer() {
    if (this.newCustomerForm.valid) {
      try {
        const form: $TSFixMe = this.newCustomerForm.value

        this.validateOpeningHours(form)

        const result = await firstValueFrom(
          this.api.post('app/customers', form, {
            usercode: this.user.userinfo.userCode,
            username: this.user.credential.username
          }))

        if (result != null) {
          alert('Create success!')
          this.ref.markForCheck()
          // this.navCtrl.pop().then()
        } else {
          alert('Create NOT OK!')
          // logger.error(result)
        }
      } catch (e) {
        alert(e.message)
      }
    } else {
      alert('Form is invalid, controleer of alle velden correct zijn ingevuld!')
    }
  }
}
