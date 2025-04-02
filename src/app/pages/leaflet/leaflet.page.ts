import { ChangeDetectorRef, Component, HostListener } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { Directory, Encoding, Filesystem, ReadFileResult } from '@capacitor/filesystem'
import { EmailComposer, HasAccountResult } from 'capacitor-email-composer'
import { environment } from '../../../environments/environment'
import { NavController } from '@ionic/angular'

const ZOOM_STEP: number = 0.125
const DEFAULT_ZOOM: number = 1

@Component({
  selector: 'app-leaflet',
  templateUrl: 'leaflet.page.html',
  styleUrls: ['leaflet.page.scss']
})
export class LeafletPage {
  @HostListener('document:click', ['$event'])
  clickout(_event: any): boolean {
    const event: any = _event || window.event
    const element: HTMLAnchorElement = event.target || event.srcElement
    // check for links with target '_blank'
    if ('A' === element.tagName && '_blank' === element.target) {
      const isShopUrl: boolean = element.href.indexOf('shop.claes-distribution.be') !== -1
      if (isShopUrl) {
        let url: string = element.href
          .replace('http://', '')
          .replace('https://', '')
          .replace('shop.claes-distribution.be', '')
        console.log(url)

        const supportedRoutes: string[] = [
          '/news'
        ]

        if (supportedRoutes.includes(url)) {
          this.navCtrl.navigateRoot(url)
          // prevent default action and stop event propagation
          event.stopPropagation()
          event.preventDefault()
          return false
        }
      }
    }
    return true
  }

  public pdfZoom: number = DEFAULT_ZOOM
  public fileUrl: string = undefined
  public today: Date = new Date()
  public loading: boolean = true

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private navCtrl: NavController
  ) {
    setTimeout((): void => {
      this.loading = true
      this.load().then()
    }, 1500)
  }

  finish(): void {
    this.loading = false
    this.ref.markForCheck()
  }

  async load(): Promise<void> {
    const date: string = new Date().toISOString()
    const current_id: string = `${date.substring(0, 4)}${(date.substring(5, 7))}`

    const result: ReadFileResult = await Filesystem.readFile({
      path: `leaflets/${current_id}_${this.culture}.pdf`,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    })
    this.fileUrl = result.data as string
    this.ref.markForCheck()
  }

  async share(): Promise<void> {
    const canShare: HasAccountResult = await EmailComposer.hasAccount()
    // const email = await this.account.getEmail()
    const filename: string = 'Promofolder.pdf'
    if (canShare.hasAccount)
      await EmailComposer.open({
        subject: 'Claes Distribution Promofolder',
        to: environment.production ? [] : ['jamie.vangeysel@groupclaes.be'],
        body: '',
        attachments: [{
          type: 'base64',
          path: this.fileUrl.replace('data:application/pdf;base64,', ''),
          name: filename
        }]
      })
  }

  public zoomIn(): void {
    this.pdfZoom += ZOOM_STEP
  }

  public zoomOut(): void {
    if (this.pdfZoom > DEFAULT_ZOOM)
      this.pdfZoom -= ZOOM_STEP
  }

  public resetZoom(): void {
    this.pdfZoom = DEFAULT_ZOOM
  }

  get culture(): string {
    return this.translate.currentLang.split('-')[0]
  }
}
