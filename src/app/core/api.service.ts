import { environment } from './../../environments/environment'
import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { AppCredential, ServerCustomer } from './user.service'
import { Observable } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  url: string = environment.api_url
  constructor(public http: HttpClient) { }

  get<T>(endpoint: string, params?: any): Observable<T> {
    return this.http.get<T>(this.url + '/' + endpoint, { params })
  }

  post<T>(endpoint: string, body: any, params?: any): Observable<T> {
    return this.http.post<T>(this.url + '/' + endpoint, body, { params })
  }

  put<T>(endpoint: string, body: any, params?: any): Observable<T> {
    return this.http.put<T>(this.url + '/' + endpoint, body, { params })
  }

  delete<T>(endpoint: string, params?: any): Observable<T> {
    return this.http.delete<T>(this.url + '/' + endpoint, { params })
  }

  patch<T>(endpoint: string, body: any, params?: any): Observable<T> {
    return this.http.patch<T>(this.url + '/' + endpoint, body, { params })
  }

  postLogin(credential: AppCredential): Observable<ServerCustomer> {
    return this.http.post<ServerCustomer>(`${this.url}/appuser/login`, credential)
  }
}
