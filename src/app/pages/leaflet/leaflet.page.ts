import { ChangeDetectorRef, Component, HostListener } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { Directory, Filesystem, GetUriResult, ReadFileResult } from '@capacitor/filesystem'
import { NavController } from '@ionic/angular'
import { UserService } from '../../core/user.service'
import { Share } from '@capacitor/share'

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
  public culture: string = undefined
  public canShare: boolean = false

  constructor(
    private ref: ChangeDetectorRef,
    private translate: TranslateService,
    private navCtrl: NavController,
    private user: UserService
  ) {
    this.culture = this.translate.currentLang.split('-')[0]
    this.loading = true
    this.load().then()

    Share.canShare().then(share => {
      this.canShare = share.value
    })
  }

  finish(): void {
    this.loading = false
    this.ref.markForCheck()
  }

  async load(): Promise<void> {
    this.loading = true
    this.fileUrl = undefined
    const date: string = new Date().toISOString()
    const current_id: string = `${date.substring(0, 4)}${(date.substring(5, 7))}`

    const result: ReadFileResult = await Filesystem.readFile({
      path: `${current_id}_${this.culture}.pdf`,
      directory: Directory.Documents
    })

    if (typeof result.data === 'string') {
      this.fileUrl = 'data:application/pdf;base64,' + result.data
    } else {
      const reader = new FileReader()
      reader.onload = (): void => {
        if (typeof reader.result === 'string') {
          this.fileUrl = reader.result
          this.ref.markForCheck()
        }
      }
      reader.readAsDataURL(result.data)
    }

    this.ref.markForCheck()
  }

  async share(): Promise<void> {
    const date: string = new Date().toISOString()
    const current_id: string = `${date.substring(0, 4)}${(date.substring(5, 7))}`

    await Filesystem.copy({
      from: `${current_id}_${this.culture}.pdf`,
      directory: Directory.Documents,
      to: `leaflets/${current_id}_${this.culture}.pdf`,
      toDirectory: Directory.Cache
    })

    const uri: GetUriResult = await Filesystem.getUri({
      path: `leaflets/${current_id}_${this.culture}.pdf`,
      directory: Directory.Cache
    })

    await Share.share({
      title: 'Promofolder.pdf',
      text: 'Claes Distribution Promofolder',
      url: uri.uri
    })

    return
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

  get isAgent(): boolean {
    return this.user.hasAgentAccess
  }
}
