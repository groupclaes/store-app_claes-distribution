import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { NavController, AlertController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { CartService } from 'src/app/core/cart.service'
import { CategoriesRepositoryService, ICategory, ICategoryT } from 'src/app/core/repositories/categories.repository.service'
import { UserService } from 'src/app/core/user.service'

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoriesPage {
  loading = true
  private _categories: ICategoryT[]
  currentCategory: ICategoryT = null
  assortmentGroups: any[]
  displaymode: string = "display-list"

  constructor(
    private navCtrl: NavController,
    private translate: TranslateService,
    private ref: ChangeDetectorRef,
    private categoriesRepository: CategoriesRepositoryService,
    private cart: CartService,
    route: ActivatedRoute
  ) {
    route.queryParams.subscribe(params => {
      this.displaymode = params['display'] || this.displaymode || "display-list"
    })

    route.params.subscribe(params => {
      this.loadCategories(+params['id'])
    })
  }

  ngOnInit() {
  }

  async loadCategories(parent?: number) {
    if (this._categories || this.assortmentGroups) { return; }
    this.loading = true
    this.ref.markForCheck()

    try {
      this.loading = true
      this.ref.markForCheck()

      if (parent) {
        this.currentCategory = await this.categoriesRepository.find(parent, this.culture)
      }

      this.assortmentGroups = await this.categoriesRepository.getAssortment(this.culture, parent)
    } catch (err) {
      console.error(err)
    } finally {
      this.loading = false
      this.ref.markForCheck()
    }
  }

  async navigatePage(category: ICategoryT) {
    const result = await this.categoriesRepository.findChildren(category.id)

    if (result && result.length > 0) {
      this.navCtrl.navigateRoot(['categories', category.id], {
        queryParams: {
          display: this.displaymode
        },
        animated: true
      })
    } else {
      this.navCtrl.navigateRoot(['products'], {
        queryParams: {
          category: category.id,
          display: this.displaymode
        },
        animated: true
      })
    }
  }

  navigateToPage(category: ICategoryT) {
    this.navCtrl.navigateForward(['products'], {
      queryParams: {
        category: category.id,
        display: this.displaymode
      }
    })
  }

  get categories(): ICategoryT[] {
    return this._categories || []
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }
  get cartLink(): any[] {
    const params: any[] = ['/carts']
    if (this.cart.active) params.push(this.cart.active.id)
    return params
  }
}
