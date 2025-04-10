import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ActivatedRoute, Params } from '@angular/router'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { NetworkService } from 'src/app/@shared/network.service'
import { ApiService } from 'src/app/core/api.service'
import { Share } from '@capacitor/share'
import { firstValueFrom } from 'rxjs'

@Component({
  selector: 'app-web-recipe-detail',
  templateUrl: './web-recipe-detail.page.html',
  styleUrls: ['./web-recipe-detail.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebRecipeDetailPage implements OnInit {
  loading: boolean = true
  isDownloading: boolean = false
  private _recipe: $TSFixMe = undefined

  constructor(
    private translate: TranslateService,
    private ref: ChangeDetectorRef,
    private logger: LoggingProvider,
    private api: ApiService,
    route: ActivatedRoute,
    public network: NetworkService
  ) {
    route.params.subscribe(async (params: Params): Promise<void> => {
      await this.load(params['id'])
    })
    this.network.connected.subscribe((): void => this.ref.markForCheck())
  }

  ngOnInit(): void {
  }

  async load(id: number): Promise<void> {
    try {
      this.loading = true
      this.ref.markForCheck()

      const result: any = await firstValueFrom(this.api.http.get(`https://api.groupclaes.be/v1/distribution/recipes/detail/${id}?culture=${this.culture.split('-')[0]}`))
      const recipe: any = result['result'].shift()
      console.log(this.recipe, result)

      this._recipe = recipe
    } catch (err) {
      this.logger.error('Error loading recipe!', err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }

  async share(): Promise<void> {
    this.ref.markForCheck()

    let url: string = `https://www.claes-distribution.be/recepten/${this.recipe.id}/${this.recipe.title.replace('/ /g', '-')}`
    switch (this.culture) {
      case 'fr-BE':
        url = `https://www.claes-distribution.be/recettes/${this.recipe.id}/${this.recipe.title.replace('/ /g', '-')}`
        break
    }

    try {
      await Share.share({
        title: this.recipe.name + ' van Claes Distribution',
        text: 'Claes Distribution Recept',
        url: url
      })
    } finally {
      this.ref.markForCheck()
    }
  }

  get hasGroupings(): boolean {
    return this.recipe?.preparationSteps
      .findIndex(x => x.text.startsWith('*')) > -1
  }

  get groupings(): any[] {
    const groupings: any[] = []
    const steps: any = this.recipe?.preparationSteps.sort((a: any, b: any) => a.position - b.position)

    let lastGroup = this.getGrouping()
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].text.trim().startsWith('*')) {
        if (lastGroup.steps.length > 0 || lastGroup.title != null)
          groupings.push(lastGroup)
        lastGroup = this.getGrouping(steps[i])
      } else {
        lastGroup.steps.push({
          text: steps[i].text,
          position: ++lastGroup.lastStepPosition
        })
      }
    }
    if (lastGroup.steps?.length > 0 || lastGroup.title != null)
      groupings.push(lastGroup)

    return groupings
  }

  getGrouping(entry?: any) {
    return {
      title: entry?.text?.trim()?.substring(1),
      position: entry?.position,
      lastStepPosition: 0,
      steps: []
    }
  }

  get recipe() {
    if (this._recipe)
      return this._recipe
    return undefined
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }
}
