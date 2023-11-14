import { firstValueFrom } from 'rxjs';
import { Injectable } from '@angular/core';
import { ProductsRepositoryService } from './repositories/products.repository.service';
import { ApiService } from './api.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  constructor(private productRepo: ProductsRepositoryService,
    private api: ApiService,
    private user: UserService) {}

    // Test customer: 20249
  async addToDepartment(id: number, departmentId: number) {
    const result = await firstValueFrom(this.api.post(`departments/${departmentId}/${id}`, null, {
      userCode: this.user.activeUser.userCode
    }))

    await this.productRepo.addToDepartment(id, departmentId)
  }

  async removeFromDepartment(id: number, departmentId: number) {
    const result = await firstValueFrom(this.api.delete(`departments/${departmentId}/${id}`, {
      userCode: this.user.activeUser.userCode
    }))

    await this.productRepo.removeFromDepartment(id, departmentId)
  }

  async addToFavourites(productId: number) {
    const result = await firstValueFrom(this.api.put(`app/favorites/${productId}/1`, null, {
      userCode: this.user.userinfo.userCode,
      customerId: this.user.activeUser.id,
      addressId: this.user.activeUser.address
    }))

    await this.productRepo.addToFavourites(productId,
      this.user.activeUser.id,
      this.user.activeUser.address)
  }

  async removeFromFavourites(productId: number) {
    const result = await firstValueFrom(this.api.put(`app/favorites/${productId}/0`, null, {
      userCode: this.user.userinfo.userCode,
      customerId: this.user.activeUser.id,
      addressId: this.user.activeUser.address
    }))

    await this.productRepo.removeFromFavourites(productId,
      this.user.activeUser.id,
      this.user.activeUser.address)
  }

  async changeCustomerDescription(productId: number, description: string) {
    const result = await firstValueFrom(this.api.put(`webshop/data/products/${productId}/customer-description`, {
      userId: this.user.userinfo.userId,
      description
    }))

    await this.productRepo.changeCustomerDescription(productId, description)
  }
}


