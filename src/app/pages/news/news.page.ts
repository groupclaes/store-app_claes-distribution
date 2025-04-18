import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { TranslateService } from '@ngx-translate/core'
import { CartService } from 'src/app/core/cart.service'
import { INewsT, NewsRepositoryService } from 'src/app/core/repositories/news.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { UserService } from 'src/app/core/user.service'
import { LoggerService } from '../../@shared/logging/log.service'
import { NavController } from '@ionic/angular'

const logger = new LoggerService('NewsPage')

@Component({
  selector: 'app-news',
  templateUrl: './news.page.html',
  styleUrls: ['./news.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsPage implements OnInit {
  @HostListener('document:click', ['$event'])
  clickout(_event: any): boolean {
    const event: any = _event || window.event
    const element: HTMLAnchorElement = event.target || event.srcElement
    // check for links with target '_blank'
    if ('A' === element.tagName && '_blank' === element.target) {
      const url = new URL(element.href)

      switch (url.hostname) {
        case 'shop.claes-distribution.be':
          const supportedRoutes: string[] = [
            '/news'
          ]

          if (supportedRoutes.includes(url.pathname)) {
            this.navCtrl.navigateRoot(url.pathname)
            // prevent default action and stop event propagation
            event.stopPropagation()
            event.preventDefault()
            return false
          } else if (url.pathname.startsWith('/products')) {
            const product_id: string = url.searchParams.get('productId')
            const query: string = url.searchParams.get('query')
            if (product_id && product_id != '0')
              this.navCtrl.navigateForward(['/products', url.searchParams.get('productId')])
            else if (query)
              this.navCtrl.navigateForward(['/products'], { queryParams: { query } })
            // prevent default action and stop event propagation
            event.stopPropagation()
            event.preventDefault()
            return false
          }
          break
        case 'www.claes-distribution.be':
          if (url.pathname.startsWith('/recepten') || url.pathname.startsWith('/recettes')) {
            const id = url.pathname.split('/')[2]
            this.navCtrl.navigateForward(['/web-recipes', id, 'preview'])
            event.stopPropagation()
            event.preventDefault()
            return false
          }
          break
      }
    }
    return true
  }

  @HostListener('window:message', ['$event'])
  message(_event: any): boolean {
    const element: any = _event.data
    if ('A' === element.tagName && '_blank' === element.target) {
      const url = new URL(element.href)

      switch (url.hostname) {
        case 'shop.claes-distribution.be':
          const supportedRoutes: string[] = [
            '/news'
          ]

          if (supportedRoutes.includes(url.pathname)) {
            this.navCtrl.navigateRoot(url.pathname)
            // prevent default action and stop event propagation
            return false
          } else if (url.pathname.startsWith('/products')) {
            const product_id: string = url.searchParams.get('productId')
            const query: string = url.searchParams.get('query')
            if (product_id && product_id != '0')
              this.navCtrl.navigateForward(['/products', url.searchParams.get('productId')])
            else if (query)
              this.navCtrl.navigateForward(['/products'], { queryParams: { query } })
            // prevent default action and stop event propagation
            return false
          }
          break
        case 'www.claes-distribution.be':
          if (url.pathname.startsWith('/recepten') || url.pathname.startsWith('/recettes')) {
            const id = url.pathname.split('/')[2]
            this.navCtrl.navigateForward(['/web-recipes', id, 'preview'])
            return false
          }
          break
      }
    }
    return true
  }

  loading: boolean = true
  news: any[]
  displayThumbnail: boolean

  constructor(
    private ref: ChangeDetectorRef,
    private user: UserService,
    private sanitizer: DomSanitizer,
    private translate: TranslateService,
    private newsRepository: NewsRepositoryService,
    private cart: CartService,
    private navCtrl: NavController,
    settings: SettingsService
  ) {
    settings.showThumbnail.then((value: boolean): void => {
      this.displayThumbnail = value
      this.ref.markForCheck()
    })
    // this.statistics.newsPageView(this.user.userinfo.userId)
  }

  ngOnInit(): void {
    this.load().then((): void => {
    })
  }

  async load(): Promise<void> {
    try {
      this.loading = true
      this.ref.markForCheck()

      const news: INewsT[] = await this.newsRepository.get(
        this.user.activeUser.id,
        this.user.activeUser.address,
        this.culture
      )

      for (let newsItem of news) {
        newsItem.content = this.b64DecodeUnicode(newsItem.content)
        newsItem.content = newsItem.content.replace(`[file='c:\\inetpub\\base64content\\button folder.txt']`, `<img alt="promo button nl" style="max-height:180px" src='/assets/img/eShop_button_NL_ClaesDistribution_Promofolder_Outlines_BG_240x240.svg' />`)
        newsItem.content = newsItem.content.replace(`[file='c:\\inetpub\\base64content\\button nieuwigheden.txt']`, `<img alt="nieuwigheden button nl" style="max-height:180px" src='/assets/img/eShop_button_NL_ClaesDistribution_Nieuwigheden_Outlines_BG_240x240.svg' />`)
        newsItem.content = newsItem.content.replace(`[file='c:\\inetpub\\base64content\\button folder mensuel.txt']`, `<img alt="promo button fr" style="max-height:180px" src='/assets/img/eShop_button_FR_ClaesDistribution_Promofolder_Outlines_BG_240x240.svg' />`)
        newsItem.content = newsItem.content.replace(`[file='c:\\inetpub\\base64content\\button nouveautes.txt']`, `<img alt="nieuwigheden button fr" style="max-height:180px" src='/assets/img/eShop_button_FR_ClaesDistribution_Nieuwigheden_Outlines_BG_240x240.svg' />`)
        newsItem.content = this.cleanBody(newsItem.content)
      }
      this.news = news

    } catch (err) {
      logger.error(err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }

  b64DecodeUnicode(str: any): string {
    // Going backwards: from byte stream, to percent-encoding, to original string.
    return decodeURIComponent(atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''))
  }

  cleanBody(body: string): string {
    return body/*.replace('/<body>/gi', '').replace('/</body>/gi', '')
      .replace('/<head>/gi', '').replace('/</head>/gi', '')
      .replace('/<html>/gi', '').replace('/</html>/gi', '')
      */.replace('/<style>/gi', '<style scoped>')
      .replace('/<!doctype html>/gi', '')
  }

  safe(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html)
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
}
