/* eslint-disable @typescript-eslint/member-delimiter-style */
import { SettingsService } from 'src/app/core/settings.service'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { Subscription } from 'rxjs'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { environment } from 'src/environments/environment'

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPage implements OnInit, OnDestroy {
  syncInterval: number
  displayDefaultPage: string
  displayThumbnail: boolean
  displayLanguage: string
  displayDefaultFilters: {
    new: boolean
    promo: boolean
    favorite: boolean
    order: boolean
  }

  subscriptions: Subscription[] = []

  constructor(
    private translate: TranslateService,
    private settings: SettingsService,
    private ref: ChangeDetectorRef,
    private logger: LoggingProvider
  ) {
  }

  get languages() {
    return this.translate.langs
  }

  get debugging() {
    return !environment.production
  }

  ngOnInit() {
    this.logger.log('SettingsPage.ngOnInit()')
    this.subscriptions.push(this.settings.SyncInterval.subscribe((interval: number) => {
      this.syncInterval = interval
    }))

    this.subscriptions.push(this.settings.DisplayDefaultPage.subscribe((defaultPage: string) => {
      this.displayDefaultPage = defaultPage
    }))

    this.subscriptions.push(this.settings.DisplayDefaultFilters.subscribe((defaultFilters: $TSFixMe) => {
      this.displayDefaultFilters = defaultFilters
    }))

    this.subscriptions.push(this.settings.DisplayThumbnail.subscribe((displayThumbnail: boolean) => {
      this.displayThumbnail = displayThumbnail
    }))

    this.displayLanguage = this.translate.currentLang
  }

  ionViewDidEnter() {
    this.ref.markForCheck()
  }

  ngOnDestroy() {
    this.logger.log('SettingsPage.ngOnDestroy()')
    this.subscriptions.forEach(r => {
      if (r && !r.closed) {
        r.unsubscribe()
        r = null
      }
    })
  }

  changeSyncInterval($event: any) {
    console.log($event)
    this.settings.setSyncInterval($event.detail.value)
  }

  changeDefaultPage($event: any) {
    this.settings.setDefaultPage($event.detail.value)
    this.ref.markForCheck()
  }

  toggleNew(): void {
    this.displayDefaultFilters.new = !this.displayDefaultFilters.new
    this.settings.setDefaultFilters(this.displayDefaultFilters)
    this.ref.markForCheck()
  }

  togglePromo(): void {
    this.displayDefaultFilters.promo = !this.displayDefaultFilters.promo
    this.settings.setDefaultFilters(this.displayDefaultFilters)
    this.ref.markForCheck()
  }

  toggleFavorite(): void {
    if (this.displayDefaultFilters.favorite === true) {
      this.displayDefaultFilters.favorite = false
    } else if (this.displayDefaultFilters.favorite === false) {
      this.displayDefaultFilters.favorite = null
    } else {
      this.displayDefaultFilters.favorite = true
    }
    this.settings.setDefaultFilters(this.displayDefaultFilters)
    this.ref.markForCheck()
  }

  toggleOrder(): void {
    this.displayDefaultFilters.order = !this.displayDefaultFilters.order
    this.settings.setDefaultFilters(this.displayDefaultFilters)
    this.ref.markForCheck()
  }

  toggleDebug(): void {
    environment.production = !environment.production
    this.ref.markForCheck()
  }

  changeThumbnail($event: any) {
    this.settings.setDisplayThumbnail($event.detail.checked)
    this.ref.markForCheck()
  }

  changeLanguage($event: any) {
    this.translate.use($event.detail.value).subscribe(x => this.ref.markForCheck())
  }
}
