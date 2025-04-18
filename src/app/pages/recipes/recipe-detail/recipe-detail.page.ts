import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ActivatedRoute, Params } from '@angular/router'
import { AlertController, NavController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { NetworkService } from 'src/app/@shared/network.service'
import { ApiService } from 'src/app/core/api.service'
import { RecipesRepositoryService } from 'src/app/core/repositories/recipes.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { UserService } from 'src/app/core/user.service'
import { Directory, DownloadFileResult, Filesystem, GetUriResult } from '@capacitor/filesystem'
import { LoggerService } from '../../../@shared/logging/log.service'
import { environment } from '../../../../environments/environment'
import { FileOpener } from '@capacitor-community/file-opener'

const logger = new LoggerService('RecipeDetailPage')

@Component({
  selector: 'app-detail',
  templateUrl: './recipe-detail.page.html',
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
    private alertCtrl: AlertController,
    private api: ApiService,
    route: ActivatedRoute,
    private navCtrl: NavController,
    public network: NetworkService
  ) {
    this.settings.showThumbnail.then((value: boolean): void => {
      this.displayThumbnail = value
      this.ref.markForCheck()
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
      logger.error('Error loading recipe!', err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }

  async open(item: any): Promise<void> {
    let uri: string
    try {
      const res: GetUriResult = await Filesystem.stat({
        path: `recipes/${item.guid}/${item.name}`,
        directory: Directory.Cache
      })
      uri = res.uri
    } catch {
      if (!this.network.online)
        return this.network.noop()

      this.isDownloading = true
      this.ref.markForCheck()
      await Filesystem.downloadFile({
        url: `${environment.pcm_url}/content/file/${item.guid}?show=true`,
        directory: Directory.Cache,
        path: `recipes/${item.guid}/${item.name}`,
        recursive: true
      }).then((res: DownloadFileResult): string => uri = res.path)
      this.ref.markForCheck()
    } finally {
      if (uri) {
        setTimeout(async (): Promise<void> => {
          try {
            await FileOpener.open({
              filePath: uri,
              openWithDefault: true,
              contentType: 'application/pdf'
            })
          } catch {
            this.navCtrl.navigateForward(['documents', 'recipes', item.guid, item.name], {
              animated: true
            })
          }
        }, 80)
      }
      this.isDownloading = false
      this.ref.markForCheck()
    }
    // this.browser.open(`https://pcm.groupclaes.be/v4/content/file/${this.recipe.guid}?show=true`, '_system', 'location=yes')
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
