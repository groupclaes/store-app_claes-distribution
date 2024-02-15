import { environment } from './../../environments/environment'
import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { AppCredential, ServerCustomer } from './user.service'
import { Observable } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private token: string

  url: string = environment.api_url
  constructor(public http: HttpClient) { }

  get<T>(endpoint: string, params?: any): Observable<T> {
    return this.http.get<T>(this.url + '/' + endpoint, {
      params,
      headers: { authorization: this.token }
    })
  }

  post<T>(endpoint: string, body: any, params?: any): Observable<T> {
    return this.http.post<T>(this.url + '/' + endpoint, body, {
      params,
      headers: { authorization: this.token }
    })
  }

  put<T>(endpoint: string, body: any, params?: any): Observable<T> {
    return this.http.put<T>(this.url + '/' + endpoint, body, {
      params,
      headers: { authorization: this.token }
    })
  }

  delete<T>(endpoint: string, params?: any): Observable<T> {
    return this.http.delete<T>(this.url + '/' + endpoint, {
      params,
      headers: { authorization: this.token }
    })
  }

  patch<T>(endpoint: string, body: any, params?: any): Observable<T> {
    return this.http.patch<T>(this.url + '/' + endpoint, body, {
      params,
      headers: { authorization: this.token }
    })
  }

  /**
   * Set the token for API requests
   * 
   * @private
   * @param token 
   */
  setToken(token: string) {
    if (token != null && token.length > 12)
    this.token = 'Bearer ' + token
  }
}
