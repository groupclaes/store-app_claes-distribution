import { Injectable } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { share } from 'rxjs/operators'
import { LoggingProvider } from '../@shared/logging/log.service'
import { ApiService } from './api.service'
import { StorageProvider } from './storage-provider.service'
import { SyncService } from './sync.service'
import { firstValueFrom } from 'rxjs'
import { environment } from 'src/environments/environment'
import { Network } from '@capacitor/network'

const LS_CREDENTIAL = 'store-app.credential'


@Injectable({
  providedIn: 'root'
})
export class UserService {
  private _user: Customer
  private _selectedCustomer: Customer
  private _credential: ISsoCredential
  private _token: string

  constructor(
    private translate: TranslateService,
    private storage: StorageProvider,
    private logger: LoggingProvider,
    private api: ApiService,
    private sync: SyncService
  ) {
    this.logger.log('User -- constructor()')
  }

  get storedCredential(): ISsoCredential {
    return this.storage.get<ISsoCredential>(LS_CREDENTIAL)
  }

  get storedUser(): ServerCustomer {
    return this.storage.get<ServerCustomer>('user')
  }

  get credential(): ISsoCredential {
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
    return this._credential && (this._credential.userType > 1 && this._credential.userType < 5)
  }

  get hasAgentAccess(): boolean {
    return this._credential && (this._credential.userType === 2 || this._credential.userType === 3)
  }

  get hasSuperUserAccess(): boolean {
    return this._credential.isAgent && this._credential.userType === 3
  }

  /**
   * Authenticate online to the SSO service
   * @param credential 
   * @returns 
   */
  async login(credential: ISsoLoginRequest): Promise<ISsoCredential | ISsoLoginResponse> {
    const connectionStatus = await Network.getStatus()
    if (connectionStatus.connected) {
      try {
        this.logger.log('UserService.login() -- logging in online')
        const response = await firstValueFrom(this.api.post<ISsoLoginResponse>(environment.sso_url, credential))
        if (response.token != null) {
          const ssoCredential = this._completeLogin(response.token)
          if (ssoCredential != null) {
            return ssoCredential
          }

          return { error: 'Invalid token receive', verified: false, token: null}
        } else {
          this.logger.error('UserService.login() -- Online login failed', { username: credential.username })

          return response
        }
      } catch (err) {
        this.logger.error('UserService.login() -- Online login error occurred, trying offline',
          credential.username, JSON.stringify(err))
        return { error: 'offline', verified: false, token: null }
      }
    }
  }

  /**
   * Try local cache with existing login
   */
  async loginLocal(): Promise<ISsoLoginResponse> {
    const cachedCredential = this.storage.get<string>(LS_CREDENTIAL)
    if (cachedCredential != null) {
      if (this._completeLogin(cachedCredential, false)) {
        return { error: null, verified: true, token: null }
      } else {
        return { error: null, verified: false, token: null }
      }
    }

    return { error: 'Invalid or expired credential found', verified: false, token: null }
  }
  // signup(credential: AppRegistrationCredential) {
  //   let request = this.api.post('appuser/signOn', credential).pipe(share())

  //   request.subscribe((res: any) => {
  //     if (res) {
  //       this._loggedIn(res, credential)
  //     }
  //   }, err => {
  //     this.logger.error('signup ERROR', err)
  //   })

  //   return request
  // }

  resetPassword(credential: ISsoLoginRequest) {
    return this.api.post(`appuser/forgot-password/now`, {
      username: credential.username
    }, {
      culture: this.translate.currentLang.split('-')[0]
    })
  }

  async logout() {
    // this.statistics.logout(this._user.userId)
    this._user = null
    this._credential = null
    await this.sync.dropTables()
    this.storage.remove(LS_CREDENTIAL)
  }

  syncData(force: boolean = false): Promise<boolean> {
    let culture = this.hasAgentAccess ? 'all' : this.translate.currentLang.split('-')[0]

    return this.sync.fullSync(this._credential, culture, force)
  }

  private _completeLogin(token: string, storeToDisk: boolean = true) {
    this.logger.debug('UserService._completeLogin() -- called')
    const ssoCredential = JSON.parse(atob(token.split('.')[1])) as ISsoCredential
    this.logger.debug('UserService._completeLogin() -- Decoded credentials from token', ssoCredential)

    if (ssoCredential.sub != null && ssoCredential.exp != null) {
      const expires = new Date(ssoCredential.exp * 1000)
      if (expires > new Date()) {
        this._credential = ssoCredential
        // Not expired

        if (storeToDisk) {
          this.logger.debug('UserService._completeLogin() -- Stored token to local storage')
          this.storage.set(LS_CREDENTIAL, token)
        }


        const user = ssoCredential.users[0]

        this._user = {
          userId: ssoCredential.sub,
          id: ssoCredential.id,
          name: ssoCredential.username,
          address: user.addressId,
          addressName: null,
          addressGroup: user.addressGroupId,
          type: ssoCredential.userType,
          city: null,
          promo: user.promo,
          bonus: user.bonusPercentage,
          fostplus: user.fostplus,
          userCode: ssoCredential.userCode
        }

        this.api.setToken(token)
        return ssoCredential
      }
    }
    return null
  }

  private _loggedIn(userResponse: ServerCustomer, credential: ISsoCredential, store: boolean = true) {
    this.logger.log('UserService -- _loggedIn() called')

    this._credential = credential

    if (store) {
      this.storage.set(LS_CREDENTIAL, credential)
    }
    this.storage.set('user', userResponse)
    this.storage.set(LS_CREDENTIAL, credential)
  }
}

export interface ISsoLoginResponse {
  error: string,
  verified: boolean
  token: string
}

export interface ISsoLoginRequest {
  username: string
  password: string
}

export interface ISsoUser {
  userCode: number,
  customerId: number,
  addressId: number,
  addressGroupId: number,
  promo: boolean,
  bonusPercentage: number,
  fostplus: boolean
}

export interface ISsoCredential {
  verified: boolean,
  username: string,
  id: number,
  userCode: number,
  userType: CustomerUserType,
  status: number,
  acceptedTermsVersion: number,
  version: number,
  users: Array<ISsoUser>,
  /**
   * Legacy user token
   */
  token: string,
  isAgent: boolean,
  agentId: number,
  iat: number,
  exp: number,
  aud: Array<string>,
  iss: string,
  sub: string | number
}

export interface AppCredential {
  username: string
  password: string
}
export interface AppRegistrationCredential extends AppCredential {
  code: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  given_name: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  last_name: string;
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
  userId?: string
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
  delvLanguage: string;
}

export type CustomerUserType = 1 /*: norml user */ |
  2 /*: agent user */ |
  3 /*: super user */ |
  4 /*: multi user */ |
  5 /*: read only multi */;