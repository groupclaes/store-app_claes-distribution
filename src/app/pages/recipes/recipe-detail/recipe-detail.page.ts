import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AlertController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { ApiService } from 'src/app/core/api.service'
import { RecipesRepositoryService } from 'src/app/core/repositories/recipes.repository.service'
import { SettingsService } from 'src/app/core/settings.service'
import { UserService } from 'src/app/core/user.service'

@Component({
  selector: 'app-detail',
  templateUrl: './recipe-detail.page.html',
  styleUrls: ['./recipe-detail.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecipeDetailPage implements OnInit {
  loading = true
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
    route: ActivatedRoute
  ) {
    this.settings.DisplayThumbnail.subscribe((displayThumbnail: boolean) => {
      this.displayThumbnail = displayThumbnail
    })
    route.params.subscribe(params => {
      this.load(params['guid'])
    })
  }

  ngOnInit() {
  }

  async load(guid: string) {
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

  open() {
    window.open(`https://pcm.groupclaes.be/v3/content/file/${this.recipe.guid}?show=true`, '_system', 'location=yes')
  }

  async mail() {
    try {
      // create loader in future versions
      const req = await this.api.post(`app/recipes/mail/${this.recipe.guid}`, this.user.credential, {
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
    if (this._recipe) {
      return this._recipe
    }
    return {}
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }
}
