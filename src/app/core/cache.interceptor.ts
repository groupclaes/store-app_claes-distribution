import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, catchError, of, tap } from 'rxjs'
import { ThumbCacheService } from './thumb-cache.service'
import { NetworkService } from '../@shared/network.service'

@Injectable()
export class CachingInterceptor implements HttpInterceptor {
  constructor(private cache: ThumbCacheService, private network: NetworkService) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // continue if not cacheable.
    if (!isCacheable(request)) { return next.handle(request) }

    // if thumbnail, retreive from cache, if not found retreive from web and store in cache
    if (isThumb(request))
      return this.cache.get(request)
        .pipe(catchError((err: Error) => {
          return sendRequest(request, next, this.cache)
        }))
    // if the connection is offline, retireve from cache or otherwise fallback to default handler
    if (this.network.offline)
      return this.cache.get(request)
        .pipe(catchError((err: Error) => {
          return next.handle(request)
        }))

    // fallback for other images when online
    return next.handle(request)
  }
}

function isCacheable(request: HttpRequest<any>): boolean {
  return /^https:\/\/pcm\.groupclaes\.be\/v4\/product-images\/dis\/[0-9]{10}/.test(request.url) // check if the request is made to pcm product-images controller with itemnum
}

function isThumb(request: HttpRequest<any>): boolean {
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