import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ActivatedRoute, Params } from '@angular/router'
import { AlertController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { NetworkService } from 'src/app/@shared/network.service'
import { ApiService } from 'src/app/core/api.service'
import { BrowserService } from 'src/app/core/browser.service'
import { RecipesRepositoryService } from 'src/app/core/repositories/recipes.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { UserService } from 'src/app/core/user.service'
import { Directory, DownloadFileResult, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

@Component({
  selector: 'app-detail',
  templateUrl: './recipe-detail.page.html',
  // styleUrls: ['./recipe-detail.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipeDetailPage implements OnInit {
  loading: boolean = true
  isDownloading: boolean = false
  private _recipe: $TSFixMe
  displayThumbnail: boolean

  constructor(
    private translate: TranslateService,
    private ref: ChangeDetectorRef,
    private user: UserService,
    private settings: SettingsService,
    private recipesRepository: RecipesRepositoryService,
    private logger: LoggingProvider,
    private alertCtrl: AlertController,
    private api: ApiService,
    route: ActivatedRoute,
    private browser: BrowserService,
    public network: NetworkService
  ) {
    this.settings.DisplayThumbnail.subscribe((displayThumbnail: boolean): void => {
      this.displayThumbnail = displayThumbnail
    })
    route.params.subscribe((params: Params): void => {
      this.load(params['guid'])
    })
    this.network.connected.subscribe((): void => this.ref.markForCheck())
  }

  ngOnInit(): void {
  }

  async load(guid: string): Promise<void> {
    try {
      this.loading = true
      this.ref.markForCheck()

      this._recipe = await this.recipesRepository.getDetail(guid, this.culture)
    } catch (err) {
      this.logger.error('Error loading recipe!', err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }

  async share(): Promise<void> {
    this.isDownloading = true
    this.ref.markForCheck()

    try {
      const result: DownloadFileResult = await Filesystem.downloadFile({
        path: this.recipe.name,
        directory: Directory.Cache,
        url: `https://pcm.groupclaes.be/v4/content/file/${this.recipe.guid}?show=true`
      })
      this.isDownloading = false
      this.ref.markForCheck()

      await Share.share({
        title: this.recipe.name,
        // text: 'Claes Distribution Recept',
        url: result.path
      })
    } finally {
      this.isDownloading = false
      this.ref.markForCheck()
    }
  }

  open(): void {
    this.browser.open(`https://pcm.groupclaes.be/v4/content/file/${this.recipe.guid}?show=true`, '_system', 'location=yes')
  }

  async mail(): Promise<void> {
    try {
      // create loader in future versions
      const req: any = await this.api.post(`app/recipes/mail/${this.recipe.guid}`, this.user.credential, {
        customer: this.user.activeUser.id,
        address: this.user.activeUser.address,
        message: '',
        culture: this.culture
      }).toPromise()
      if (req) {
        const alert = await this.alertCtrl.create({
          header: this.translate.instant('recipeMailSend'),
          message: this.translate.instant('recipeMailMessageSend')
        })
        alert.present()
      }
    } catch (err) {
      const alert = await this.alertCtrl.create({
        header: this.translate.instant('recipeMailError'),
        message: this.translate.instant('recipeMailMessageError')
      })
      alert.present()
    } finally {
      // dismiss loader in future versions
    }
  }

  get recipe() {
    if (this._recipe)
      return this._recipe
    return {}
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }
}
