import { Injectable } from '@angular/core'

import { LogPublisher, LogConsole, LogLocalStorage, LogWebApi, LogPublisherConfig } from './log-publishers'
import { Observable, of } from 'rxjs'
import { HttpClient } from '@angular/common/http'

@Injectable({
  providedIn: 'root'
})
export class LogPublishersService {
  constructor(private http: HttpClient) {
    // Build publishers arrays
    this.buildPublishers()
  }

  // Public properties
  publishers: LogPublisher[] = []

  getLoggers(): Observable<LogPublisherConfig[]> {
    return of([
      {
        "loggerName": "console",
        "loggerLocation": "",
        "isActive": true
      },
      {
        "loggerName": "localstorage",
        "loggerLocation": "logging",
        "isActive": true
      },
      {
        "loggerName": "webapi",
        "loggerLocation": "/log",
        "isActive": false
      }
    ])
  }

  // Build publishers array
  buildPublishers(): void {
    let logPub: LogPublisher

    this.getLoggers().subscribe(response => {
      for (let pub of response.filter(p => p.isActive)) {
        switch (pub.loggerName.toLowerCase()) {
          case "console":
            logPub = new LogConsole()
            break

          case "localstorage":
            logPub = new LogLocalStorage()
            break

          case "webapi":
            logPub = new LogWebApi(this.http)
            break
        }
        // Set location of logging
        logPub.location = pub.loggerLocation
        // Add publisher to array
        this.publishers.push(logPub)
      }
    })
  }
}
