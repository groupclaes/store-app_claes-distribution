import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { ApiService } from 'src/app/core/api.service'
import { NewsRepositoryService } from 'src/app/core/repositories/news.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { UserService } from 'src/app/core/user.service'

@Component({
  selector: 'app-news',
  templateUrl: './news.page.html',
  styleUrls: ['./news.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsPage implements OnInit {
  loading = true
  news: any[]
  displayThumbnail: boolean

  constructor(
    private ref: ChangeDetectorRef,
    private user: UserService,
    private sanitizer: DomSanitizer,
    private translate: TranslateService,
    private logger: LoggingProvider,
    private newsRepository: NewsRepositoryService,
    settings: SettingsService
  ) {
    settings.DisplayThumbnail.subscribe((displayThumbnail: boolean) => {
      this.displayThumbnail = displayThumbnail
    })
    // this.statistics.newsPageView(this.user.userinfo.userId)
  }

  ngOnInit() {
    this.loadNews()
  }

  async loadNews() {
    try {
      this.loading = true
      this.ref.markForCheck()

      const news = await this.newsRepository.get(
        this.user.activeUser.id,
        this.user.activeUser.addressId,
        this.culture
      )

      for (let newsItem of news) {
        newsItem.content = this.b64DecodeUnicode(newsItem.content)
        newsItem.content = newsItem.content.replace(`[file='c:\\inetpub\\base64content\\button folder.txt']`, `<img style="max-height:180px" src='/assets/img/eShop_button_NL_ClaesDistribution_Promofolder_Outlines_BG_240x240.svg'></img>`)
        newsItem.content = newsItem.content.replace(`[file='c:\\inetpub\\base64content\\button nieuwigheden.txt']`, `<img style="max-height:180px" src='/assets/img/eShop_button_NL_ClaesDistribution_Nieuwigheden_Outlines_BG_240x240.svg'></img>`)
        newsItem.content = newsItem.content.replace(`[file='c:\\inetpub\\base64content\\button folder mensuel.txt']`, `<img style="max-height:180px" src='/assets/img/eShop_button_FR_ClaesDistribution_Promofolder_Outlines_BG_240x240.svg'></img>`)
        newsItem.content = newsItem.content.replace(`[file='c:\\inetpub\\base64content\\button nouveautes.txt']`, `<img style="max-height:180px" src='/assets/img/eShop_button_FR_ClaesDistribution_Nieuwigheden_Outlines_BG_240x240.svg'></img>`)
        newsItem.content = this.cleanBody(newsItem.content)
      }
      this.news = news

      console.log(this.news)
    } catch (err) {
      this.logger.error(err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }

  b64DecodeUnicode(str) {
    // Going backwards: from bytestream, to percent-encoding, to original string.
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

  safe(html: string) {
    return this.sanitizer.bypassSecurityTrustHtml(html)
  }

  get culture(): string {
    return this.translate.currentLang
  }
}
