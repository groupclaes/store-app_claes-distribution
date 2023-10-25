/* eslint-disable @typescript-eslint/naming-convention */
import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'
import { LoggingProvider } from '../@shared/logging/log.service'
import { StorageProvider } from './storage-provider.service'

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private _syncInterval: BehaviorSubject<number>
  private _displayDefaultPage: BehaviorSubject<string>
  private _displayDefaultFilters: BehaviorSubject<$TSFixMe>
  private _displayThumbnail: BehaviorSubject<boolean>

  constructor(
    private storage: StorageProvider,
    private logger: LoggingProvider) {
    this.logger.log('SettingsService -- constructor()')

    this._syncInterval = new BehaviorSubject(43200000); // 12hours
    this._displayDefaultPage = new BehaviorSubject('/categories')
    this._displayDefaultFilters = new BehaviorSubject({
      new: false,
      promo: false,
      favorite: false,
      order: true
    })
    this._displayThumbnail = new BehaviorSubject(true)

    this.init()
  }



  get SyncInterval(): Observable<number> {
    return this._syncInterval.asObservable()
  }

  get DisplayDefaultPage(): Observable<string> {
    return this._displayDefaultPage.asObservable()
  }

  get DisplayDefaultFilters(): Observable<$TSFixMe> {
    return this._displayDefaultFilters.asObservable()
  }

  get DisplayThumbnail(): Observable<boolean> {
    return this._displayThumbnail.asObservable()
  }

  init() {
    const interval: number = this.storage.get('app-syncinterval')
    if (interval !== undefined) {
      this._syncInterval.next(interval)
    } else {
      this.storage.set('app-syncinterval', 43200000)
    }

    const displayDefaultPage: string = this.storage.get('app-displaydefaultpage')
    if (displayDefaultPage) {
      this._displayDefaultPage.next(displayDefaultPage)
    } else {
      this.storage.set('app-displaydefaultpage', '/categories')
    }

    const displayDefaultFilters: $TSFixMe = this.storage.get('app-displaydefaultfilters')
    if (displayDefaultFilters) {
      this._displayDefaultFilters.next(displayDefaultFilters)
    } else {
      this.storage.set('app-displaydefaultfilters', {
        new: false,
        promo: false,
        favorite: false,
        order: true
      })
    }

    const displayThumbnail: boolean = this.storage.get('app-displaythumbnail')
    if (displayThumbnail || displayThumbnail === false) {
      this._displayThumbnail.next(displayThumbnail)
    } else {
      this.storage.set('app-displaythumbnail', true)
    }
  }

  setSyncInterval(val: number) {
    this._syncInterval.next(val)
    this.storage.set('app-syncinterval', val)
  }

  setDefaultPage(val: string) {
    this._displayDefaultPage.next(val)
    this.storage.set('app-displaydefaultpage', val)
  }

  setDefaultFilters(val: $TSFixMe) {
    this._displayDefaultFilters.next(val)
    this.storage.set('app-displaydefaultfilters', val)
  }

  setDisplayThumbnail(val: boolean) {
    this._displayThumbnail.next(val)
    this.storage.set('app-displaythumbnail', val)
  }
}
