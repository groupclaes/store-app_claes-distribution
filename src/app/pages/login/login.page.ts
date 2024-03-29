import { AppCredential, ServerCustomer, UserService } from '../../core/user.service'
import { environment } from './../../../environments/environment'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { LoadingController, NavController, Platform, ToastController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { HttpErrorResponse } from '@angular/common/http'
import { SyncService } from 'src/app/core/sync.service'
import { DataIntegrityChecksumsRepositoryService } from 'src/app/core/repositories/data-integrity-checksums.repository.service'
import { StorageProvider } from 'src/app/core/storage-provider.service'
import { CartsRepositoryService } from 'src/app/core/repositories/carts.repository.service'
import { CurrentExceptionsRepositoryService } from 'src/app/core/repositories/current-exceptions.repository.service'
import { FormGroup, FormBuilder, Validators } from '@angular/forms'
import { SettingsService } from 'src/app/core/settings.service'
import { take } from 'rxjs/operators'
import { CartService } from 'src/app/core/cart.service'

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPage implements OnInit {
  private _loading: HTMLIonLoadingElement
  accountForm: FormGroup
  busy = false
  dbError = false

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private sanitizer: DomSanitizer,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private user: UserService,
    private fb: FormBuilder,
    private loadingCtrl: LoadingController,
    private sync: SyncService,
    private storage: StorageProvider,
    private settings: SettingsService,
    private platform: Platform,
    private checksumRepository: DataIntegrityChecksumsRepositoryService,
    private cartsRepository: CartsRepositoryService,
    private exceptionsRepository: CurrentExceptionsRepositoryService,
    private cart: CartService
  ) { }

  ngOnInit() {
    this.accountForm = this.fb.group({
      username: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    })
  }

  ionViewDidEnter() {
    const credential = this.user.storedCredential
    if (credential) {
      this.accountForm.setValue(credential)
    } else {
      this.accountForm.setValue({ username: '', password: '' })
    }

    this.busy = true
    this.ref.markForCheck()

    const timer = setTimeout(() => {
      console.error('There was an error loading the database...')
      this.toast(this.translate.instant('dbLoadError'))
      this.busy = false
      this.dbError = true
      this.ref.markForCheck()
    }, 10000)

    this.sync.Initialize().then(async (dbOk) => {
      this.busy = !dbOk
      clearTimeout(timer)
      this.ref.markForCheck()

      /* Automatically sign in if credentials are found in storage and application is initialized */
      if (this.accountForm.valid) {
        await this.sleep(600)
        await this.login()
      }
    })
  }

  async login() {
    if (this.busy || this.accountForm.invalid) return

    this.busy = true
    this.ref.markForCheck()
    const oldCredential = this.user.storedCredential

    this.user.login(this.accountForm.value).subscribe(async (customer: ServerCustomer) => {
      await this.cart.init(this.accountForm.value, this.user.userinfo.userId)
      if (customer) {
        // Check if we need to sync
        const syncRequired = await this.syncRequired(oldCredential)
        if (syncRequired) {
          this._loading = await this.loadingCtrl.create({
            spinner: 'lines',
            message: this.translate.instant('syncPage')
          })
          this._loading.present()
          this.ref.markForCheck()

          try {
            await this.user.syncData().catch(() => {
              this._loading.dismiss()
              this.busy = false
              this.toast(this.translate.instant('syncError'))
            })
          } catch {
            this._loading.dismiss()
            this.busy = false
            this.toast(this.translate.instant('syncError'))
          }

          if (this.user.userinfo.type === 1) {
            this._loading.message = this.translate.instant('preparing')
            this.ref.markForCheck()

            const prepare = await this.sync.prepareCurrentExceptions({
              id: this.user.userinfo.id,
              addressId: this.user.userinfo.address,
              addressGroupId: this.user.userinfo.addressGroup,
              userCode: this.user.userinfo.userCode,
              userType: this.user.userinfo.type,
              name: '',
              address: '',
              streetNum: '',
              zipCode: '',
              city: '',
              country: '',
              phoneNum: '',
              vatNum: '',
              language: '',
              promo: this.user.userinfo.promo,
              fostplus: this.user.userinfo.fostplus,
              bonusPercentage: this.user.userinfo.bonus,
              addressName: '',
              delvAddress: '',
              delvStreetNum: '',
              delvZipCode: '',
              delvCity: '',
              delvCountry: '',
              delvPhoneNum: '',
              delvLanguage: ''
            })
            try {
              this._loading.dismiss()
            } catch { }
            this.ref.markForCheck()

            if (prepare) {
              this.navCtrl.navigateForward(await this.defaultPage)
            } else {
              this.toast(this.translate.instant('unknownError'))
            }
          } else {
            this._loading.message = this.translate.instant('preparing')
            try {
              await this.cartsRepository.deleteOld(90)
            } catch {

            }
            await this.exceptionsRepository.delete()
            this._loading.dismiss()
            this.ref.markForCheck()
            this.navCtrl.navigateForward(await this.defaultPage)
          }
        } else {
          this.toast(this.translate.instant('localData'))

          if (this.user.userinfo.type === 1) {
            try {
              this._loading.message = this.translate.instant('preparing')
            } catch { }
            const prepare = await this.sync.prepareCurrentExceptions({
              id: this.user.userinfo.id,
              addressId: this.user.userinfo.address,
              addressGroupId: this.user.userinfo.addressGroup,
              userCode: this.user.userinfo.userCode,
              userType: this.user.userinfo.type,
              name: '',
              address: '',
              streetNum: '',
              zipCode: '',
              city: '',
              country: '',
              phoneNum: '',
              vatNum: '',
              language: '',
              promo: this.user.userinfo.promo,
              fostplus: this.user.userinfo.fostplus,
              bonusPercentage: this.user.userinfo.bonus,
              addressName: '',
              delvAddress: '',
              delvStreetNum: '',
              delvZipCode: '',
              delvCity: '',
              delvCountry: '',
              delvPhoneNum: '',
              delvLanguage: ''
            })
            try {
              this._loading.dismiss()
            } catch { }
            this.ref.markForCheck()

            if (prepare) {
              this.navCtrl.navigateForward(await this.defaultPage)
            } else {
              this.toast(this.translate.instant('unknownError'))
            }
          } else {
            this.navCtrl.navigateForward(await this.defaultPage)
          }
        }
      } else {
        this.toast(this.translate.instant('loginError'))
      }
      this.busy = false
      this.ref.markForCheck()
    }, async (error: HttpErrorResponse) => {
      try {
        // dismiss loading if present
        if (this._loading) {
          this._loading.dismiss()
        }
      } catch { }
      if (error) {
        if (error.status === 0) {
          // there is no connection
          this.ref.markForCheck()
          await this.cart.init(this.accountForm.value, this.user.userinfo.userId)
          if (this.user.hasAgentAccess) {
            this._loading = await this.loadingCtrl.create({
              spinner: 'lines',
              message: this.translate.instant('preparing')
            })
            this._loading.present()
            try {
              await this.cartsRepository.deleteOld(90)
            } catch {

            }
            await this.exceptionsRepository.delete()
            this._loading.dismiss()
            this.ref.markForCheck()
          }
          this.navCtrl.navigateForward(await this.defaultPage)
        } else if (error.status === 404 || error.status === 401) {
          this.toast(this.translate.instant('loginError'))
        } else {
          this.toast(this.translate.instant('unknownError'))
        }
      } else {
        this.toast(this.translate.instant('unknownError'))
      }
      this.busy = false
      this.ref.markForCheck()
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async syncRequired(oldCredential: AppCredential): Promise<boolean> {
    if (!oldCredential) {
      return true
    }
    if (this.accountForm.value.username !== oldCredential.username) {
      return true
    }

    // check if sync is needed
    const syncInterval: number = this.storage.get(`app-syncinterval`)
    const result = await this.checksumRepository.get<any>('lastSync')
    const res = await this.checksumRepository.get<any>()
    console.log(res)

    if (!result) {
      return true
    }

    console.log(result)

    const lastSync: Date = (result && result.length >= 1) ? new Date(result[0].dateChanged) : new Date(1970, 0)

    return new Date().getTime() - syncInterval > lastSync.getTime()
  }

  resetPassword() {
    this.busy = true
    this.ref.markForCheck()

    this.user.resetPassword(this.accountForm.value).subscribe(_ => {
      this.toast(this.translate.instant('passwordResetOk'))
    }, () => {
      this.toast(this.translate.instant('passwordResetError'))
    }, () => {
      this.busy = false
      this.ref.markForCheck()
    })
  }

  signup() {
    this.navCtrl.navigateForward('/account/signup')
  }

  private async toast(message: string, duration: number = 3000) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: duration,
      position: 'top'
    })
    await toast.present()
  }

  get defaultPage(): Promise<string> {
    return this.settings.DisplayDefaultPage.pipe<string>(take(1)).toPromise()
  }

  get backgroundImage() {
    let size = 'small'
    if (this.platform.width() >= 1366) {
      size = 'large'
    } else if (this.platform.width() >= 768) {
      size = 'medium'
    }

    switch (this.translate.currentLang) {
      case 'nl':
        return this.sanitizer.bypassSecurityTrustStyle(`url('${environment.pcm_url}/content/dis/website/banner-image?size=${size}')`)

      default:
        return this.sanitizer.bypassSecurityTrustStyle(`url('${environment.pcm_url}/content/dis/website/banner-image/100/fr?size=${size}')`)
    }
  }

  get appVersion(): string {
    return environment.version
  }
}
