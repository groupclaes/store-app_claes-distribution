import { TranslateService } from '@ngx-translate/core'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core'
import { UserService } from 'src/app/core/user.service'
import { CartService } from 'src/app/core/cart.service'
import { NetworkService } from 'src/app/@shared/network.service'
import { CustomersRepositoryService } from '../../core/repositories/customers.repository.service'
import { BrowserService } from '../../core/browser.service'
import { environment } from '../../../environments/environment'
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling'

@Component({
  selector: 'app-datasheets',
  templateUrl: './datasheets-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DatasheetsPage implements OnInit {
  @ViewChild(CdkVirtualScrollViewport) virtualScroll: CdkVirtualScrollViewport

  loading: boolean = true
  private _datsheets: $TSFixMe[]
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
    this.load(true)
  }

  openDatasheet(guid: string) {
    this.browser.open(`${environment.pcm_url}/content/file/${guid}?show=true`, '_system', 'location=yes')
  }

  get datsheets(): $TSFixMe[] {
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

  get online(): boolean {
    return this.network.online
  }
}
