import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, OnDestroy } from '@angular/core';
import { Subscription, merge, of, fromEvent, map, throwError, catchError } from 'rxjs';
import { ConfigService } from './config.service';
import { AuthService } from './auth.service';


@Injectable({
  providedIn: 'root',
})
export class ApiService implements OnDestroy {
  public token: string;
  public isMS: boolean; // IE, Edge, etc
  networkStatus = false;
  networkStatus$: Subscription = Subscription.EMPTY;
  private headers;
  private http: HttpClient;

  apiPath: string;
  env: 'local' | 'dev' | 'test' | 'prod';

  constructor(private configService: ConfigService,
    private authService: AuthService
  ) {
    this.http = inject(HttpClient);
  }

  // Provide a getter for others to check current state.
  get isNetworkOffline() {
    return !this.networkStatus;
  }

  errorHandler(error: HttpErrorResponse) {
    return throwError(() => new Error(error.message));
  }

  ngOnDestroy(): void {
    this.networkStatus$.unsubscribe();
  }

  init() {
    // If config is setting api, override.
    if (this.configService.config['API_LOCATION']) {
      if (this.configService.config['API_PATH'] && this.configService.config['API_LOCATION'] !== 'http://localhost:3000') {
        this.apiPath = this.configService.config['API_LOCATION'] + this.configService.config['API_PATH'];
      } else {
        this.apiPath = this.configService.config['API_LOCATION'];
      }
    } else {
      this.apiPath = window.location.origin + '/api';
    }

    this.headers = this.initHeaders();
    if (!this.headers) {
      console.log('No API key provided.');
    }

    this.env = this.configService.config['ENVIRONMENT'];
    this.checkNetworkStatus();
  }

  initHeaders() {
    return new HttpHeaders().set('x-api-key', this.configService.config['API_KEY']);
  }

  checkNetworkStatus() {
    this.networkStatus = navigator.onLine;
    this.networkStatus$ = merge(of(null),
      fromEvent(window, 'online'),
      fromEvent(window, 'offline')
    )
      .pipe(map(() => navigator.onLine))
      .subscribe((status) => {
        console.log(status === false ? 'Network Offline' : 'Network Online');
        this.networkStatus = status;
      });
  }

  public getEnvironment(): string {
    return this.env;
  }

  get(pk, queryParamsObject = null as any) {
    if (this.networkStatus) {
      const queryString = this.generateQueryString(queryParamsObject);
      
      // Create a new headers object for this request
      let requestHeaders = this.headers;
      
      // If logged in, add the JWT token to the headers.
      if (this.authService.jwtToken) {
        requestHeaders = requestHeaders.append('Authorization', `Bearer ${this.authService.jwtToken}`);
      } else {
        requestHeaders = requestHeaders.append('Authorization', `guest`);
      }
      
      const url = `${this.apiPath}/${pk}?${queryString}`;
      
      return this.http.get(url, { headers: requestHeaders, observe: 'response' })
        .pipe(
          map(response => response?.body),
          catchError(this.errorHandler)
        );
    } else {
      throw 'Network Offline';
    }
  }

  put(pk, obj, queryParamsObject = null as any) {
    if (this.networkStatus) {
      const queryString = this.generateQueryString(queryParamsObject);
      
      // Create a new headers object for this request
      let requestHeaders = this.headers;
      
      // If logged in, append the JWT token to the headers.
      if (this.authService.jwtToken) {
        requestHeaders = requestHeaders.append('Authorization', `Bearer ${this.authService.jwtToken}`);
      } else {
        requestHeaders = requestHeaders.append('Authorization', `guest`);
        console.log('calling as guest');
      }
      
      return this.http.put<any>(`${this.apiPath}/${pk}?${queryString}`, obj, { headers: requestHeaders, observe: 'response' })
        .pipe(
          map(response => response?.body),
          catchError(this.errorHandler));
    } else {
      throw 'Network Offline';
    }
  }

  post(pk, obj, queryParamsObject = null as any) {
    if (this.networkStatus) {
      const queryString = this.generateQueryString(queryParamsObject);
      
      // Create a new headers object for this request
      let requestHeaders = this.headers;
      
      // If logged in, append the JWT token to the headers.
      if (this.authService.jwtToken) {
        requestHeaders = requestHeaders.append('Authorization', `Bearer ${this.authService.jwtToken}`);
      } else {
        requestHeaders = requestHeaders.append('Authorization', `guest`);
      }
      
      return this.http
        .post<any>(`${this.apiPath}/${pk}?${queryString}`, obj, { headers: requestHeaders, observe: 'response' })
        .pipe(
          map(response => response?.body),
          catchError(this.errorHandler)
        );
    } else {
      throw 'Network Offline';
    }
  }

  delete(pk, queryParamsObject = null as any) {
    if (this.networkStatus) {
      const queryString = this.generateQueryString(queryParamsObject);
      
      // Create a new headers object for this request
      let requestHeaders = this.headers;
      
      // If logged in, add the JWT token to the headers.
      if (this.authService.jwtToken) {
        requestHeaders = requestHeaders.append('Authorization', `Bearer ${this.authService.jwtToken}`);
      } else {
        requestHeaders = requestHeaders.append('Authorization', `guest`);
      }
      
      return this.http
        .delete<any>(`${this.apiPath}/${pk}?${queryString}`, { headers: requestHeaders })
        .pipe(catchError(this.errorHandler));
    } else {
      throw 'Network Offline';
    }
  }

  private generateQueryString(queryParamsObject) {
    let queryString = '';
    if (queryParamsObject) {
      for (const key of Object.keys(queryParamsObject)) {
        queryString += `&${key}=${queryParamsObject[key]}`;
      }
      queryString = queryString.substring(1);
    }
    return queryString;
  }

  private buildUrl(apiPath, pathArray, queryParamsObject) {
    let url = apiPath;
    pathArray.forEach((path) => {
      url += `/${path}`;
    });
    url += `?${this.generateQueryString(queryParamsObject)}`;

    return url;
  }
}
