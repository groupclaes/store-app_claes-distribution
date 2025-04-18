import { Injectable } from '@angular/core'
import { environment } from 'src/environments/environment'
import { Plugins } from '@capacitor/core'
import { LoggerService } from '../@shared/logging/log.service'
import { Platform } from '@ionic/angular'

const { CapacitorReadNativeSetting } = Plugins

const logger = new LoggerService('SettingsService')

const DEFAULT_VALUES = {
  DEFAULT_PAGE: '/categories',
  SHOW_THUMBNAIL: true,
  // Synchronisation
  DATA_AUTOMATIC_DOWNLOADS: true,
  SYNC_INTERVAL: '43200000',
  SYNC_LEAFLETS: true,
  SYNC_DATASHEETS: false,
  SYNC_RECIPES: false,
  SYNC_USAGE_MANUALS: false,
  // DEFAULT FILTERS
  DEFAULT_FILTER_NEW: false,
  DEFAULT_FILTER_PROMO: false,
  DEFAULT_FILTER_FAVORITE: false,
  DEFAULT_FILTER_ORDER: true
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  // automate_data_refresh: boolean

  constructor(platform: Platform) {
    // get automation values
    this.refresh().then()

    // override settings in test / desktop
    if (platform.is('desktop') || !environment.production) {
      // DEFAULT_VALUES.DEFAULT_FILTER_PROMO = true
      DEFAULT_VALUES.DEFAULT_FILTER_FAVORITE = true
      DEFAULT_VALUES.SYNC_DATASHEETS = true
      DEFAULT_VALUES.SYNC_USAGE_MANUALS = true
      DEFAULT_VALUES.DEFAULT_PAGE = '/products'
    }
  }

  async refresh(): Promise<void> {
    // get automation values
    // let values = await this.automation()
    // this.automate_data_refresh = values.automate_data_refresh
  }

  get syncInterval(): Promise<string> {
    return this.readFromSettings<string>('sync_interval', DEFAULT_VALUES.SYNC_INTERVAL)
  }

  get showThumbnail(): Promise<boolean> {
    return this.readFromSettings('show_thumbnail', DEFAULT_VALUES.SHOW_THUMBNAIL)
  }

  get defaultPage(): Promise<string> {
    return this.readFromSettings<string>('default_page', DEFAULT_VALUES.DEFAULT_PAGE)
  }

  get dataAutomaticDownloads(): Promise<boolean> {
    return this.readFromSettings<boolean>('data_automatic_downloads', DEFAULT_VALUES.DATA_AUTOMATIC_DOWNLOADS)
  }

  async defaultFilters(): Promise<any> {
    let filter_new: boolean = await this.readFromSettings<boolean>('default_filter_new', DEFAULT_VALUES.DEFAULT_FILTER_NEW)
    let filter_promo: boolean = await this.readFromSettings<boolean>('default_filter_promo', DEFAULT_VALUES.DEFAULT_FILTER_PROMO)
    let filter_favorite: boolean = await this.readFromSettings<boolean>('default_filter_favorite', DEFAULT_VALUES.DEFAULT_FILTER_FAVORITE)
    let filter_order: boolean = await this.readFromSettings<boolean>('default_filter_order', DEFAULT_VALUES.DEFAULT_FILTER_ORDER)

    logger.notice('automate_values()', {
      filter_new,
      filter_promo,
      filter_favorite,
      filter_order
    })

    return {
      filter_new,
      filter_promo,
      filter_favorite,
      filter_order
    }
  }

  async getSyncValues(): Promise<ISyncSettings> {
    let interval: string = await this.readFromSettings<string>('sync_interval', DEFAULT_VALUES.SYNC_INTERVAL)
    let leaflets: boolean = await this.readFromSettings<boolean>('sync_leaflets', DEFAULT_VALUES.SYNC_LEAFLETS)
    let datasheets: boolean = await this.readFromSettings<boolean>('sync_datasheets', DEFAULT_VALUES.SYNC_DATASHEETS)
    let recipes: boolean = await this.readFromSettings<boolean>('sync_recipes', DEFAULT_VALUES.SYNC_RECIPES)
    let usageManuals: boolean = await this.readFromSettings<boolean>('sync_usage-manuals', DEFAULT_VALUES.SYNC_USAGE_MANUALS)

    if (!environment.production)
      interval = '120000'

    logger.notice('sync_values()', {
      interval: +interval,
      leaflets,
      datasheets,
      recipes,
      usageManuals
    })

    return {
      interval: +interval,
      leaflets,
      datasheets,
      recipes,
      usageManuals
    }
  }

  async readFromSettings<T>(key: string, default_value: T): Promise<T> {
    return CapacitorReadNativeSetting?.read({ key })
      .then((r: { value: T }) => r.value as T) ?? Promise.resolve(default_value)
  }
}

export interface ISyncSettings {
  interval: number
  leaflets: boolean
  datasheets: boolean
  recipes: boolean
  usageManuals: boolean
}
