import { NgModule } from '@angular/core'
import { PreloadAllModules, RouterModule, Routes } from '@angular/router'

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./pages/home/home.module').then(m => m.HomePageModule)
  },
  {
    path: 'account/signup',
    loadChildren: () => import('./pages/signup/signup.module').then( m => m.SignupPageModule)
  },
  {
    path: 'account/login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'categories',
    loadChildren: () => import('./pages/categories/categories.module').then(m => m.CategoriesPageModule)
  },
  {
    path: 'categories/:id',
    loadChildren: () => import('./pages/categories/categories.module').then(m => m.CategoriesPageModule)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'settings',
    loadChildren: () => import('./pages/settings/settings.module').then(m => m.SettingsPageModule)
  },
  {
    path: 'reports',
    loadChildren: () => import('./pages/reports/reports.module').then(m => m.ReportsPageModule)
  },
  {
    path: 'recipes',
    loadChildren: () => import('./pages/recipes/recipes.module').then(m => m.RecipesPageModule)
  },
  {
    path: 'recipes/:guid',
    loadChildren: () => import('./pages/recipes/recipe-detail/recipe-detail.module').then(m => m.RecipeDetailPageModule)
  },
  {
    path: 'news',
    loadChildren: () => import('./pages/news/news.module').then(m => m.NewsPageModule)
  },
  {
    path: 'departments',
    loadChildren: () => import('./pages/departments/departments.module').then(m => m.DepartmentsPageModule)
  },
  {
    path: 'departments/:id',
    loadChildren: () => import('./pages/departments/department-detail/department-detail.module').then(m => m.DepartmentDetailPageModule)
  },
  {
    path: 'products',
    loadChildren: () => import('./pages/products/products.module').then(m => m.ProductsPageModule)
  },
  {
    path: 'products/:id',
    loadChildren: () => import('./pages/products/product-detail/product-detail.module').then(m => m.ProductDetailPageModule)
  },
  {
    path: 'sync',
    loadChildren: () => import('./pages/sync/sync.module').then(m => m.SyncPageModule)
  },
  {
    path: 'carts',
    loadChildren: () => import('./pages/carts/carts.module').then(m => m.CartsPageModule)
  },
  {
    path: 'carts/history',
    loadChildren: () => import('./pages/carts/cart-history/cart-history.module').then(m => m.CartHistoryPageModule)
  },
  {
    path: 'carts/:id',
    loadChildren: () => import('./pages/carts/cart-detail/cart-detail.module').then(m => m.CartDetailPageModule)
  },
  {
    path: 'customers',
    loadChildren: () => import('./pages/customers/customers.module').then( m => m.CustomersPageModule)
  },
  {
    path: 'notes',
    loadChildren: () => import('./pages/notes/notes.module').then( m => m.NotesPageModule)
  }
]

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
