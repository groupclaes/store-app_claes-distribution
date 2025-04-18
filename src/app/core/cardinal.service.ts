// @ts-ignore
import pack from '../../../package.json'
import { environment } from '../../environments/environment'
import { Injectable } from '@angular/core'
import { BackgroundFetch, BackgroundFetchStatus } from '@transistorsoft/capacitor-background-fetch'
import { Platform } from '@ionic/angular'
import { ServerCustomer, UserService } from './user.service'
import { SyncService } from './sync.service'
import { TranslateService } from '@ngx-translate/core'
import { LoggerService } from '../@shared/logging/log.service'
import { ISyncSettings, SettingsService } from './settings.service'
import { ApiService } from './api.service'
import { firstValueFrom } from 'rxjs'
import { HttpErrorResponse } from '@angular/common/http'

const logger = new LoggerService('CardinalService')

let emulate
if (!environment.production) {
  emulate = {
    platform: true,
    device_info: true,
    battery_info: true
  }
}

@Injectable({
  providedIn: 'root'
})
export class CardinalService {
  private _status: CardinalStatus

  constructor(
    private platform: Platform,
    private sync: SyncService,
    private user: UserService,
    private translate: TranslateService,
    private appSettings: SettingsService,
    private api: ApiService
  ) {
    logger.debug('constructor() -- app_version; is_production', pack.version, environment.production)
    this.status = CardinalStatus.INITIALIZING
    logger.debug('STARTING')

    this.initComponents()
  }

  private async initComponents(): Promise<void> {
    await this.user.awaitLogin()

    if (this.platform.is('ios')) {
      try {
        BackgroundFetch.stop()
        const syncSettings = await this.appSettings.getSyncValues()
        const status: BackgroundFetchStatus = await BackgroundFetch.configure({
          // do check max once per hour, updating planning mainly utilizes location updates
          minimumFetchInterval: syncSettings.interval > 0 ? (syncSettings.interval / 60000) : 60
        }, async (taskId: string): Promise<void> => {
          localStorage.setItem('BackgroundFetch-' + new Date().toISOString(), 'x')
          // https://uynguyen.github.io/2020/09/26/Best-practice-iOS-background-processing-Background-App-Refresh-Task/
          // https://github.com/transistorsoft/capacitor-background-fetch/tree/master
          logger.debug('[BackgroundFetch] EVENT:', taskId)
          // Perform your work in an awaited Promise
          const result = await this.backgroundTaskWork('backgroundFetch')
          logger.debug('[BackgroundFetch] work complete:', result)
          // [REQUIRED] Signal to the OS that your work is complete.
          await BackgroundFetch.finish(taskId)
        }, async (taskId: string): Promise<void> => {
          // The OS has signalled that your remaining background-time has expired.
          // You must immediately complete your work and signal #finish.
          logger.debug('[BackgroundFetch] TIMEOUT:', taskId)
          // [REQUIRED] Signal to the OS that your work is complete.
          await BackgroundFetch.finish(taskId)
        })

        // Checking BackgroundFetch status:
        if (status !== BackgroundFetch.STATUS_AVAILABLE) {
          this.status = CardinalStatus.FAILED
          // Uh-oh:  we have a problem:
          if (status === BackgroundFetch.STATUS_DENIED) {
            logger.warn('The user explicitly disabled background behavior for this app or for the whole system.')
          } else if (status === BackgroundFetch.STATUS_RESTRICTED) {
            logger.emergency('Background updates are unavailable and the user cannot enable them again.')
          }
        }
      } catch (err) {
        logger.error('[BackgroundFetch] ERROR:', err)
      }
    } else if (emulate?.platform) {
      const syncSettings = await this.appSettings.getSyncValues()
      setInterval(async (): Promise<void> => {
        logger.debug('setInterval() -- start, ext interval in %s minutes', syncSettings.interval > 0 ? (syncSettings.interval / 60000) : 60)
        await this.backgroundTaskWork('interval')
      }, (syncSettings.interval > 0 ? syncSettings.interval : 3600000) / 4)
    }

    // run all tasks manually
    this.status = CardinalStatus.RUNNING
    await this.backgroundTaskWork('init')
  }

  private async evaluate_data_freshness() {
    logger.debug('evaluate_data_freshness() -- start')
    let promise: Promise<boolean>
    // check data readiness, if data is stale update in background
    if (this.user.userinfo) {
      let culture: string = this.user.hasAgentAccess ? 'all' : this.culture
      if (this.user.activeUser != null)
        promise = this.sync.fullSync(this.user.credential, culture, false, this.user.activeUser, this.user.userinfo.userId)
      else
        promise = this.sync.fullSync(this.user.credential, culture, false, undefined, this.user.userinfo.userId)
    } else
      promise = new Promise<boolean>(r => r(true))

    logger.debug('evaluate_data_freshness() -- end')
    return promise
  }

  // PCM
  private async evaluate_datsheet_cache(): Promise<boolean> {
    logger.debug('evaluate_datsheet_cache() -- start')
    try {
      await this.sync.cacheDatasheets(this.user.userinfo, this.culture, this.user.activeUser?.id, this.user.activeUser?.address)
      return true
    } catch (err) {
      logger.error('evaluate_datsheet_cache() error', err)
      return false
    } finally {
      logger.debug('evaluate_datsheet_cache() -- end')
    }
  }

  private async evaluate_leaflet_cache(): Promise<boolean> {
    logger.debug('evaluate_leaflet_cache() -- start')
    try {
      await this.sync.validateLeaflet(this.user.userinfo.userId, this.culture)
      return true
    } catch (err) {
      logger.error('evaluate_leaflet_cache() error', err)
      return false
    } finally {
      logger.debug('evaluate_leaflet_cache() -- end')
    }
  }

  private async evaluate_recieps_cache(): Promise<boolean> {
    logger.debug('evaluate_recieps_cache() -- start')
    try {
      await this.sync.cacheRecipes(this.user.userinfo, this.culture, this.user.activeUser?.id, this.user.activeUser?.address)
      return true
    } catch (err) {
      logger.error('evaluate_recieps_cache() error', err)
      return false
    } finally {
      logger.debug('evaluate_recieps_cache() -- end')
    }
  }

  private async evaluate_usageManuals_cache(): Promise<boolean> {
    logger.debug('evaluate_usageManuals_cache() -- start')
    try {
      await this.sync.cacheUsageManuals(this.user.userinfo, this.culture, this.user.activeUser?.id, this.user.activeUser?.address)
      return true
    } catch (err) {
      logger.error('evaluate_usageManuals_cache() error', err)
      return false
    } finally {
      logger.debug('evaluate_usageManuals_cache() -- end')
    }
  }

  private async evaluate_auth_status(): Promise<boolean> {
    logger.debug('evaluate_auth_status() -- start')
    try {
      const res: ServerCustomer = await firstValueFrom(this.api.postLogin(this.user.storedCredential))
      logger.debug('evaluate_auth_status() -- postLogin response ', res)
      return true
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        switch (err.status) {
          case 401:
            // user is not authorized
            await this.user.logout()
            throw new Error('Unauthenticated')

          case 404:
            // user is not found
            await this.user.logout()
            throw new Error('Unauthenticated')
        }
      }
      logger.error('evaluate_auth_status() error', err)
      return false
    } finally {
      logger.debug('evaluate_auth_status() -- end')
    }
  }

  private async backgroundTaskWork(source: string): Promise<void> {
    localStorage.setItem('backgroundTaskWork', JSON.stringify([source, new Date()]))
    if (this.status !== CardinalStatus.RUNNING)
      return logger.info('backgroundTaskWork() -- CardinalService is not RUNNING, canceling work due to status; ', CardinalStatus[this.status])

    if (!this.user.userinfo?.userId)
      return logger.info('backgroundTaskWork() -- CardinalService cannot run background work due to unauthenticated status!')

    this.status = CardinalStatus.WORKING
    logger.debug('backgroundTaskWork() -- start, source; ', source)
    const syncSettings: ISyncSettings = await this.appSettings.getSyncValues()

    // try {
    //   // send logs to server
    //   this.logsService.post(this.account.Technician, LoggerService.get()).subscribe(r => {
    //     if (r === null) {
    //       LoggerService.clear()
    //     }
    //   }, err => {
    //     console.error(err)
    //   })

    //   LoggerService.clear()
    // } catch (err) {
    //   console.error(err)
    // }

    let work: Promise<boolean>[] = [
      // this.evaluate_service_orders(),
      // this.evaluate_device_info(),
      // this.evaluate_technician_locations()
    ]

    try {
      await this.evaluate_auth_status()
    } catch {
      this.status = CardinalStatus.FAILED
      return
    }

    // await this.appSettings.refresh()

    // if (this.appSettings.automate_planning_refresh || source !== 'backgroundFetch')
    //   work.push(this.evaluate_calendar_updates())

    if (source === 'post-login') {
      if (syncSettings.datasheets)
        work.push(this.evaluate_datsheet_cache())
      if (syncSettings.leaflets)
        work.push(this.evaluate_leaflet_cache())
      if (syncSettings.recipes)
        work.push(this.evaluate_recieps_cache())
      if (syncSettings.usageManuals)
        work.push(this.evaluate_usageManuals_cache())
    }

    // this.appSettings.automate_data_refresh &&  || source !== 'backgroundFetch'
    logger.debug('backgroundTaskWork() -- automate_data_refresh, includes(source), source', ['backgroundFetch', 'interval'].includes(source), source) // , this.appSettings.automate_data_refresh
    if (['backgroundFetch', 'interval'].includes(source)) {
      if (syncSettings.datasheets)
        work.push(this.evaluate_datsheet_cache())
      if (syncSettings.leaflets)
        work.push(this.evaluate_leaflet_cache())
      work.push(this.evaluate_data_freshness())
    }

    Promise.all(work).then((results: boolean[]): void => {
      logger.info('backgroundTaskWork() -- success', results)
    }).catch((err: any): void => {
      logger.warn('backgroundTaskWork() -- error', err)
    }).finally((): void => {
      this.status = CardinalStatus.RUNNING
      logger.debug('backgroundTaskWork() -- end')
    })
  }

  public async schedule(source: string, timeout: number = 10000): Promise<void> {
    window.setTimeout(async () => {
      await this.backgroundTaskWork(source)
    }, timeout)
  }

  set status(value: CardinalStatus) {
    logger.info(`Status-- changed from '${CardinalStatus[this.status]}' to '${CardinalStatus[value]}'!`)
    this._status = value
  }

  get status(): CardinalStatus {
    return this._status
  }

  get settings(): CardinalSettings {
    return environment.cardinal_settings
  }

  get culture(): string {
    if (this.translate.currentLang)
      return this.translate.currentLang.split('-')[0]
    return environment.default_language.split('-')[0]
  }
}

//#region enums & interfaces
export enum CardinalStatus {
  INITIALIZING = -1,
  RUNNING = 1,
  WORKING = 2,
  PAUSED = 4,
  FAILED = 5
}

export interface CardinalSettings {
  battery_thresholds: {
    location: number,
    notifications: number,
    background_fetch: number
  }
}

//#endregion
