import { TranslateService } from '@ngx-translate/core'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core'
import { UserService } from 'src/app/core/user.service'
import { CartService } from 'src/app/core/cart.service'
import { NetworkService } from 'src/app/@shared/network.service'
import { CustomersRepositoryService, IGetDatasheet } from '../../core/repositories/customers.repository.service'
import { environment } from '../../../environments/environment'
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { FileOpener, FileOpenerOptions } from '@capacitor-community/file-opener'
import { Directory, DownloadFileResult, Filesystem, GetUriResult, ProgressStatus } from '@capacitor/filesystem'
import { NavController } from '@ionic/angular'

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
  private _datasheets: IGetDatasheet[]
  private _query: string = ''

  constructor(
    private translate: TranslateService,
    private navCtrl: NavController,
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
    if (this._datasheets && !force) {
      this.ref.markForCheck()
      for (let datasheet of this._datasheets) {
        try {
          await Filesystem.stat({
            path: `datasheets/${datasheet.guid}/${datasheet.name}`,
            directory: Directory.Cache
          })
          datasheet['available'] = true
        } catch {
          datasheet['available'] = false
        } finally {
          this.ref.markForCheck()
        }
      }
      return
    } else if (!this._datasheets) {
      this._datasheets = []
      this.loading = true
      this.ref.markForCheck()
    }

    try {
      this._datasheets = await this.repo.getDatasheets(
        this.user.activeUser.id,
        this.user.activeUser.address,
        this.culture.split('-')[0],
        this._query
      )
    } catch (err) {
      console.error(err)
    } finally {
      this.isDownloading = false
      this.loading = false
      if (force)
        this.virtualScroll.scrollToIndex(0)
      this.ref.markForCheck()

      for (let datasheet of this._datasheets) {
        try {
          await Filesystem.stat({
            path: `datasheets/${datasheet.guid}/${datasheet.name}`,
            directory: Directory.Cache
          })
          datasheet['available'] = true
        } catch {
          datasheet['available'] = false
        } finally {
          this.ref.markForCheck()
        }
      }
    }
  }

  filter(event: $TSFixMe): void {
    this._query = event.target.value
    this.load(true).then((): void => {
    })
  }

  async openDatasheet(datasheet: IGetDatasheet): Promise<void> {
    // check if file is available in cache
    let uri: string
    try {
      const res: GetUriResult = await Filesystem.stat({
        path: `datasheets/${datasheet.guid}/${datasheet.name}`,
        directory: Directory.Cache
      })
      uri = res.uri
    } catch {
      if (!this.network.online)
        return this.network.noop()

      datasheet['available'] = undefined
      this.ref.markForCheck()
      await Filesystem.downloadFile({
        url: `${environment.pcm_url}/content/file/${datasheet.guid}?show=true`,
        directory: Directory.Cache,
        path: `datasheets/${datasheet.guid}/${datasheet.name}`,
        recursive: true
      }).then((res: DownloadFileResult): string => uri = res.path)
      this.ref.markForCheck()
    } finally {
      if (uri) {
        datasheet['available'] = true
        this.ref.markForCheck()
        setTimeout((): void => {
          FileOpener.open({
            filePath: uri,
            openWithDefault: true,
            contentType: 'application/pdf'
          })
          // this.navCtrl.navigateForward(['datasheets', datasheet.guid], {
          //   animated: true
          // })
        }, 80)
      } else {
        datasheet['available'] = false
        this.ref.markForCheck()
      }
    }
  }

  async downloadAllDatasheets(): Promise<void> {
    this.loading = true
    this.ref.markForCheck()

    // create key<value> object key is the guid and value is the array of itemnums linked to the datasheet
    let body: { [key: string]: string[] } = {}
    for (const datasheet of this._datasheets) {
      if (body[datasheet.guid])
        body[datasheet.guid].push(datasheet.itemnum)
      else
        body[datasheet.guid] = [datasheet.itemnum]
    }

    try {
      const extra: string = this.currentCustomer ? `${this.currentCustomer}/` : ''
      const extraQ: string = this._query.trim().length > 0 ? `${this._query.trim().toLocaleLowerCase()}_` : ''
      const fn: string = `datasheets/${extra}${extraQ}${new Date().toISOString().substring(0, 10)}.zip`

      this.progress = 0
      this.ref.markForCheck()

      await Filesystem.addListener('progress', (progress: ProgressStatus): void => {
        this.isDownloading = true
        this.loading = false
        this.progress = progress.bytes / progress.contentLength
        this.ref.markForCheck()
      })
      await Filesystem.downloadFile({
        url: `${environment.pcm_url}/content/download`,
        data: body,
        headers: { 'content-type': 'application/json; charset=UTF-8' },
        directory: Directory.Data,
        path: `${fn}`,
        recursive: true,
        method: 'POST',
        progress: true
      })
      this.progress = 1
      this.loading = false
      this.ref.markForCheck()

      const uri: GetUriResult = await Filesystem.getUri({
        directory: Directory.Data,
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

  get datasheets(): IGetDatasheet[] {
    return this._datasheets || []
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

  get currentCustomer(): string {
    if (this.user.hasAgentAccess)
      return this.user.activeUser.addressName != null ? `${this.user.activeUser.address} ${this.user.activeUser.addressName}` : `${this.user.activeUser.id} ${this.user.activeUser.name}`
    else if (this.user.multiUser)
      return this.user.activeUser.addressName != null ? this.user.activeUser.addressName : this.user.activeUser.name

    return undefined
  }
}
