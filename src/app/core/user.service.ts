import { Injectable } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { share } from 'rxjs/operators'
import { LoggingProvider } from '../@shared/logging/log.service'
import { ApiService } from './api.service'
import { StorageProvider } from './storage-provider.service'
import { SyncService } from './sync.service'

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
    private logger: LoggingProvider,
    private api: ApiService,
    private sync: SyncService
  ) {
    this.logger.log('User -- constructor()')
  }

  login(credential: AppCredential) {
    let request = this.api.postLogin(credential).pipe(share())

    request.subscribe((res: ServerCustomer) => {
      if (res) {
        // this.statistics.login(res.Id)
        this._loggedIn(res, credential)
      }
    }, err => {
      this.logger.error('signup ERROR', err)
      const userResponse = this.storage.get<ServerCustomer>('user')
      const storedCredential = this.storage.get<AppCredential>('credential')
      if (storedCredential && userResponse) {
        if (storedCredential.username == credential.username && storedCredential.password == credential.password) {
          this._loggedIn(userResponse, credential)
        }
      }
    })

    return request
  }

  signup(credential: AppCredential) {
    let request = this.api.post('appuser/signOn', credential).pipe(share())

    request.subscribe((res: any) => {
      if (res) {
        this._loggedIn(res, credential)
      }
    }, err => {
      this.logger.error('signup ERROR', err)
    })

    return request
  }

  resetPassword(credential: AppCredential) {
    return this.api.post(`appuser/forgot-password/now`, {
      username: credential.username
    }, {
      culture: this.translate.currentLang.split('-')[0]
    })
  }

  loginLocal(userResponse: ServerCustomer, credential: AppCredential) {
    this._loggedIn(userResponse, credential)
  }

  logout() {
    // this.statistics.logout(this._user.userId)
    this._user = null
    this._credential.password = ''
    this.storage.set('credential', this._credential)
  }

  syncData(): Promise<boolean> {
    let culture = this.hasAgentAccess ? 'all' : this.translate.currentLang.split('-')[0]

    return this.sync.fullSync(this._credential, culture, false)
  }

  get storedCredential(): AppCredential {
    return this.storage.get<AppCredential>('credential')
  }

  get storedUser(): ServerCustomer {
    return this.storage.get<ServerCustomer>('user')
  }

  get credential(): AppCredential {
    return this._credential || null
  }

  get userinfo(): Customer {
    return this._user || null
  }

  set activeUser(value: Customer) {
    this._selectedCustomer = value
  }

  get activeUser(): Customer {
    if (this.multiUser)
      return this._selectedCustomer
    if (this._user && this._user.type === 1)
      return this.userinfo
    return null
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
    this.logger.log('UserService -- _loggedIn() called')
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
}

export interface AppCredential {
  username: string
  password: string
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

export type CustomerUserType = 1 /*: norml user */ |
  2 /*: agent user */ |
  3 /*: super user */ |
  4 /*: multi user */ |
  5 /*: read only multi */;