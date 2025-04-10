import { TranslateService } from '@ngx-translate/core'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core'
import { UserService } from 'src/app/core/user.service'
import { CartService } from 'src/app/core/cart.service'
import { NetworkService } from 'src/app/@shared/network.service'
import { CustomersRepositoryService } from '../../core/repositories/customers.repository.service'
import { BrowserService } from '../../core/browser.service'
import { environment } from '../../../environments/environment'
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { FileOpener, FileOpenerOptions } from '@capacitor-community/file-opener'
import { Directory, Filesystem, GetUriResult, ProgressStatus } from '@capacitor/filesystem'

@Component({
  selector: 'app-datasheets',
  templateUrl: './datasheets-page.component.html',
  styles: [
    'ion-fab {\n' +
    '  margin-bottom: var(--ion-safe-area-bottom, 0);\n' +
    '}'
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DatasheetsPage implements OnInit {
  @ViewChild(CdkVirtualScrollViewport) virtualScroll: CdkVirtualScrollViewport

  loading: boolean = true
  isDownloading: boolean = false
  progress: number = 0
  buffer: number = 0
  private _datsheets: IPCMObject[]
  private _query: string = ''

  constructor(
    private translate: TranslateService,
    private browser: BrowserService,
    private ref: ChangeDetectorRef,
    private repo: CustomersRepositoryService,
    private cart: CartService,
    public network: NetworkService,
    private user: UserService
  ) {
    this.network.connected.subscribe((): void => this.ref.markForCheck())
  }

  ngOnInit(): void {
  }

  ionViewDidEnter(): void {
    setTimeout(async () => {
      await this.load()
    }, 120)
  }

  async load(force?: boolean): Promise<void> {
    if (this._datsheets && !force) {
      this.ref.markForCheck()
      return
    } else if (!this._datsheets) {
      this._datsheets = []
      this.loading = true
      this.ref.markForCheck()
    }

    try {
      this._datsheets = await this.repo.getDatasheets(
        this.user.activeUser.id,
        this.user.activeUser.address,
        this.culture.split('-')[0],
        this._query
      )
    } catch (err) {
      console.error(err)
    } finally {
      this.loading = false
      if (force)
        this.virtualScroll.scrollToIndex(0)
      this.ref.markForCheck()
    }
  }

  filter(event: $TSFixMe): void {
    this._query = event.target.value
    this.load(true).then((): void => {
    })
  }

  openDatasheet(guid: string): void {
    this.browser.open(`${environment.pcm_url}/content/file/${guid}?show=true`, '_system', 'location=yes')
  }

  async downloadAllDatasheets(): Promise<void> {
    this.isDownloading = true
    this.ref.markForCheck()

    // create key<value> object key is the guid and value is the array of itemnums linked to the datasheet
    let body: { [key: string]: string[] } = {}
    for (const datasheet of this._datsheets) {
      if (body[datasheet.guid])
        body[datasheet.guid].push(datasheet.itemnum)
      else
        body[datasheet.guid] = [datasheet.itemnum]
    }

    try {
      const extra: string = this.user.userinfo.type === 2 ? `_${this.user.activeUser.id}-${this.user.activeUser.address}` : ''
      const fn: string = `datasheets${extra}_${new Date().toISOString().substring(0, 10)}.zip`

      this.progress = 0
      this.ref.markForCheck()

      await Filesystem.addListener('progress', (progress: ProgressStatus): void => {
        this.progress = progress.bytes / progress.contentLength
        this.buffer = Math.min(this.progress + .1, 1)
        this.ref.markForCheck()
      })
      this.buffer = .1
      await Filesystem.downloadFile({
        url: `${environment.pcm_url}/content/download`,
        data: body,
        headers: { 'content-type': 'application/json; charset=UTF-8' },
        directory: Directory.Documents,
        path: `${fn}`,
        recursive: true,
        method: 'POST',
        progress: true
      })
      this.progress = 1
      this.ref.markForCheck()

      const uri: GetUriResult = await Filesystem.getUri({
        directory: Directory.Documents,
        path: `${fn}`
      })
      this.isDownloading = false
      this.ref.markForCheck()
      await Filesystem.removeAllListeners()

      try {
        const fileOpenerOptions: FileOpenerOptions = {
          filePath: uri.uri,
          contentType: 'application/zip',
          openWithDefault: true
        }
        await FileOpener.open(fileOpenerOptions)
      } catch (e) {
        console.log('Error opening file', e)
      }
    } finally {
      this.isDownloading = false
      this.ref.markForCheck()
    }
  }

  get datsheets(): IPCMObject[] {
    return this._datsheets || []
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get cartLink(): any[] {
    const params: any[] = ['/carts']
    if (this.cart.active)
      params.push(this.cart.active.id)
    return params
  }

  get isAgent(): boolean {
    return this.user.hasAgentAccess
  }

  get internalUser(): boolean {
    return this.user.userinfo.id > 0 && this.user.userinfo.id < 1000
  }
}

export interface IPCMObject {
  guid: string
  name: string
  itemnum: string
  languages: string[]
  objects: string[]
}
