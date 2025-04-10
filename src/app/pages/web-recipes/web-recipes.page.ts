import { TranslateService } from '@ngx-translate/core'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { IRecipe, RecipesRepositoryService } from 'src/app/core/repositories/recipes.repository.service'
import { NavController } from '@ionic/angular'
import { CartService } from 'src/app/core/cart.service'
import { NetworkService } from 'src/app/@shared/network.service'

@Component({
  selector: 'app-web-recipes',
  templateUrl: './web-recipes.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebRecipesPage implements OnInit {
  loading: boolean = true
  reachedEnd: boolean = false
  private _recipes: $TSFixMe[]
  private _query = ''
  private _items = 50

  constructor(
    private translate: TranslateService,
    private navCtrl: NavController,
    private ref: ChangeDetectorRef,
    private recipesRepository: RecipesRepositoryService,
    private cart: CartService,
    public network: NetworkService
  ) {
    this.network.connected.subscribe(() => this.ref.markForCheck())
  }

  ngOnInit() {
    this.load()
  }

  async load(additional?: boolean, force?: boolean) {
    if (this._recipes && !additional && !force) {
      this.ref.markForCheck()
      return
    } else if (!this._recipes) {
      this._recipes = []
      this.reachedEnd = false
      this.loading = true
      this.ref.markForCheck()
    }

    try {
      const result = await this.recipesRepository.queryLimit(
        `%${this._query || ''}%`,
        `%\"${this.culture.split('-')[0]}\":true%`,
        this._items - 50,
        50
      )

      // if (result.length === 0) {
      //   this.logger.error('no rows!')
      // }

      if (result.length <= 49) {
        this.reachedEnd = true
      }

      if (additional) {
        this._recipes = this._recipes.concat(result)
      } else {
        this._recipes = result
      }
    } catch (err) {
      console.error(err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }

  filterRecipes(event: $TSFixMe): void {
    this._query = event.target.value
    this._items = 50
    this.load(null, true)
  }

  open(recipe: IRecipe) {
    this.navCtrl.navigateForward(['recipes', recipe.guid], {
      animated: true
    })
  }

  async doInfinite(event: any) {
    this._items += 50
    await this.load(true)
    event.target.complete()
  }

  get recipes(): $TSFixMe[] {
    return this._recipes || []
  }

  get searchTerm(): string {
    if (this._query) {
      return this._query
    }
    return ''
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get cartLink(): any[] {
    const params: any[] = ['/carts']
    if (this.cart.active) params.push(this.cart.active.id)
    return params
  }

  get online(): boolean {
    return this.network.online
  }
}
