import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, catchError, of, tap } from 'rxjs'
import { ThumbCacheService } from './thumb-cache.service'

@Injectable()
export class CachingInterceptor implements HttpInterceptor {
  constructor(private cache: ThumbCacheService) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // continue if not cacheable.
    if (!isCacheable(request)) { return next.handle(request) }

    return this.cache.get(request)
      .pipe(catchError(err => {
        console.log(err)
        // if there is an error retreiving from cache, send request
        return sendRequest(request, next, this.cache)
      }))
  }
}

function isCacheable(request: HttpRequest<any>): boolean {
  return /^https:\/\/pcm\.groupclaes\.be\/v4\/product-images\/dis\/[0-9]{10}\?s=thumb$/.test(request.url)
}

function sendRequest(
  req: HttpRequest<any>,
  next: HttpHandler,
  cache: ThumbCacheService): Observable<HttpEvent<any>> {
  return next.handle(req).pipe(
    tap(event => {
      // There may be other events besides the response.
      if (event instanceof HttpResponse) {
        cache.put(req, event) // Update the cache.
      }
    })
  )
}