import { AppCredential, ServerCustomer, UserService } from './../../core/user.service'
import { environment } from './../../../environments/environment'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { LoadingController, NavController, ToastController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { HttpErrorResponse } from '@angular/common/http'
import { SyncService } from 'src/app/core/sync.service'
import { DataIntegrityChecksumsRepositoryService } from 'src/app/core/repositories/data-integrity-checksums.repository.service'
import { StorageProvider } from 'src/app/core/storage-provider.service'
import { CartsRepositoryService } from 'src/app/core/repositories/carts.repository.service'
import { CurrentExceptionsRepositoryService } from 'src/app/core/repositories/current-exceptions.repository.service'

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPage implements OnInit {
  private _loading: HTMLIonLoadingElement
  public account = {
    username: '',
    password: ''
  }
  busy = false
  dbError = false

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private sanitizer: DomSanitizer,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private user: UserService,
    private loadingCtrl: LoadingController,
    private sync: SyncService,
    private storage: StorageProvider,
    private checksumRepository: DataIntegrityChecksumsRepositoryService,
    private cartsRepository: CartsRepositoryService,
    private exceptionsRepository: CurrentExceptionsRepositoryService
  ) { }

  ngOnInit() {
  }

  ionViewDidEnter() {
    const credential = this.user.storedCredential
    if (credential) {
      this.account = credential
      this.ref.markForCheck()
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

    this.sync.Initialize().then((dbOk) => {
      this.busy = !dbOk
      clearTimeout(timer)
      this.ref.markForCheck()
    })
  }

  async login() {
    if (this.busy) return

    this.busy = true
    this.ref.markForCheck()
    const oldCredential = this.user.storedCredential

    this.user.login(this.account).subscribe(async (customer: ServerCustomer) => {
      // await this.cart.init(this.account, this.user.userinfo.userId)
      if (customer) {
        // Check if we need to sync
        const syncRequired = await this.syncRequired(oldCredential)
        if (syncRequired) {
          this._loading = await this.loadingCtrl.create({
            spinner: 'crescent',
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
              // this.navCtrl.navigateForward('')
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
            this.navCtrl.navigateForward('')
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
              // this.navCtrl.navigateForward('')
            } else {
              this.toast(this.translate.instant('unknownError'))
            }
          } else {
            this.navCtrl.navigateForward('')
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
          // await this.cart.init(this.account, this.user.userinfo.userId)
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
          this.navCtrl.navigateForward('')
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
    if (this.account.username !== oldCredential.username) {
      return true
    }

    // check if sync is needed
    const syncInterval: number = this.storage.get(`app-syncinterval`)
    const result = await this.checksumRepository.get<any>('lastSync')
    if (!result) {
      return true
    }

    const lastSync: Date = (result && result.length >= 1) ? new Date(result[0].dateChanged) : new Date(1970, 0)

    return new Date().getTime() - syncInterval > lastSync.getTime()
  }

  resetPassword() {
    this.busy = true
    this.ref.markForCheck()

    this.user.resetPassword(this.account).subscribe(_ => {
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

  get backgroundImage() {
    switch (this.translate.currentLang) {
      case 'nl':
        return this.sanitizer.bypassSecurityTrustStyle(`url('https://pcm.groupclaes.be/v3/content/dis/website/banner-image?size=large')`)

      default:
        return this.sanitizer.bypassSecurityTrustStyle(`url('https://pcm.groupclaes.be/v3/content/dis/website/banner-image/100/fr?size=large')`)
    }
  }

  get appVersion(): string {
    return environment.version
  }
}
