import { Injectable } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { share } from 'rxjs/operators'
import { LoggerService } from '../@shared/logging/log.service'
import { ApiService } from './api.service'
import { StorageProvider } from './storage-provider.service'
import { SyncService } from './sync.service'
import { Observable } from 'rxjs'
import { NavController } from '@ionic/angular'

const logger = new LoggerService('StorageProvider')

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private _user: Customer
  private _selectedCustomer: Customer
  private _credential: AppCredential

  constructor(
    private translate: TranslateService,
    private storage: StorageProvider,
    private api: ApiService,
    private sync: SyncService,
    private navCtrl: NavController
  ) {
    logger.debug('constructor()')
  }

  login(credential: AppCredential): Observable<ServerCustomer> {
    let request: Observable<ServerCustomer> = this.api.postLogin(credential).pipe(share())

    request.subscribe({
      next: (res: ServerCustomer): void => {
        if (res) {
          // this.statistics.login(res.Id)
          this._loggedIn(res, credential)
        }
      },
      error: (err: any): void => {
        logger.error('signup ERROR', err)
        const userResponse: ServerCustomer = this.storage.get<ServerCustomer>('user')
        const storedCredential: AppCredential = this.storage.get<AppCredential>('credential')
        if (storedCredential && userResponse) {
          if (storedCredential.username == credential.username && storedCredential.password == credential.password) {
            this._loggedIn(userResponse, credential)
          }
        }
      }
    })

    return request
  }

  login_guest(): void {
    this._loggedIn(
      {
        CustomerId: 0,
        AddressId: 0,
        AddressGroupId: 0,
        UserType: 0,
        AddressName: '',
        CustomerName: '',
        BonusPercentage: 0,
        City: '',
        Fostplus: false,
        Promo: false
      },
      {
        username: undefined,
        password: undefined
      }
    )
  }

  signup(credential: AppRegistrationCredential) {
    let request = this.api.post('appuser/signOn', credential).pipe(share())

    request.subscribe({
      next: (res: ServerCustomer): void => {
        if (res) this._loggedIn(res, credential)
      },
      error: (err: any): void => {
        logger.error('signup ERROR', err)
      }
    })

    return request
  }

  resetPassword(credential: AppCredential) {
    return this.api.post(`appuser/forgot-password/now`, { username: credential.username }, { culture: this.currentCulture })
  }

  loginLocal(userResponse: ServerCustomer, credential: AppCredential) {
    this._loggedIn(userResponse, credential)
  }

  async logout(): Promise<void> {
    // this.statistics.logout(this._user.userId)
    this._user = null
    this._credential.password = ''
    await this.sync.dropTables()
    await this.sync.clearDocumentCaches()
    this.storage.set('credential', this._credential)
    localStorage.removeItem('active-user')
    await this.navCtrl.navigateRoot('/account/login')
  }

  syncData(force: boolean = false): Promise<boolean> {
    let culture: string = this.hasAgentAccess ? 'all' : this.currentCulture

    return this.sync.fullSync(this._credential, culture, force, undefined, this._user.userId)
  }

  async awaitLogin(): Promise<void> {
    return new Promise<void>(async (r) => {
      while (true) {
        if (!this._user)
          await new Promise(x => setTimeout(x, 10))
        else
          return r()
      }
    })
  }

  get storedCredential(): AppCredential {
    return this.storage.get<AppCredential>('credential')
  }

  get storedUser(): ServerCustomer {
    return this.storage.get<ServerCustomer>('user')
  }

  get credential(): AppCredential {
    return this._credential || undefined
  }

  get userinfo(): Customer {
    return this._user || undefined
  }

  set activeUser(value: Customer) {
    this._selectedCustomer = value
  }

  get activeUser(): Customer {
    if (this.multiUser)
      return this._selectedCustomer
    if (this._user && [0, 1].includes(this._user.type))
      return this.userinfo
    return undefined
  }

  get isGuest(): boolean {
    return this._user && this._user.type === 0
  }

  get multiUser(): boolean {
    return this._user && (this._user.type === 2 || this._user.type === 3 || this._user.type === 4)
  }

  get hasAgentAccess(): boolean {
    return this._user && (this._user.type === 2 || this._user.type === 3)
  }

  get hasSuperUserAccess(): boolean {
    return this._user && this._user.type === 3
  }

  private _loggedIn(userResponse: ServerCustomer, credential: AppCredential) {
    logger.debug('UserService -- _loggedIn() called')
    this._user = {
      userId: userResponse.Id,
      id: userResponse.CustomerId,
      name: userResponse.CustomerName,
      address: userResponse.AddressId,
      addressName: userResponse.AddressName,
      addressGroup: userResponse.AddressGroupId,
      type: userResponse.UserType,
      city: userResponse.City,
      promo: userResponse.Promo,
      bonus: userResponse.BonusPercentage,
      fostplus: userResponse.Fostplus,
      userCode: userResponse.UserCode
    }

    this._credential = credential

    this.storage.set('user', userResponse)
    this.storage.set('credential', credential)
  }

  get currentCulture(): string {
    return this.translate.currentLang.split('-')[0]
  }
}

export interface AppCredential {
  username: string
  password: string
}

export interface AppRegistrationCredential extends AppCredential {
  code: string
  given_name: string
  last_name: string
}

export interface ServerCustomer {
  Id?: number
  AddressGroupId: number
  AddressId: number
  AddressName: string
  BonusPercentage: number
  City: string
  CustomerId: number
  CustomerName: string
  Fostplus: boolean
  Promo: boolean
  UserType: CustomerUserType
  UserCode?: number
}

export interface Customer {
  userId?: number
  id: number
  name: string
  address: number
  addressName: string
  city: string
  addressGroup: number
  bonus: number
  fostplus: boolean
  promo: boolean
  type: CustomerUserType
  userCode: number

  streetNum?: string
  zipCode?: string
  country?: string
  phoneNum?: string
  vatNum?: string
  language?: string
  bonusPercentage?: number
  // addressId?: number
  delvAddress?: string
  delvStreetNum?: string
  delvZipCode?: string
  delvCity?: string
  delvCountry?: string
  delvPhoneNum?: string
  delvLanguage?: string
}

export interface AppCustomerModel {
  id: number
  addressId: number
  addressGroupId: number
  userCode: number
  userType: CustomerUserType
  name: string
  address: string
  streetNum: string
  zipCode: string
  city: string
  country: string
  phoneNum: string
  vatNum: string
  language: string
  promo: boolean
  fostplus: boolean
  bonusPercentage: number
  addressName: string
  delvAddress: string
  delvStreetNum: string
  delvZipCode: string
  delvCity: string
  delvCountry: string
  delvPhoneNum: string
  delvLanguage: string
}

export type CustomerUserType = 0 /* Guest */ |
  1 /*: normal user */ |
  2 /*: agent user */ |
  3 /*: super user */ |
  4 /*: multi user */ |
  5 /*: read only multi */;
