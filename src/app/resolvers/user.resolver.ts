import { Injectable } from '@angular/core';
import { Resolve } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class UserResolver implements Resolve<any> {
  constructor(private authService: AuthService) {}

  resolve(): Observable<any> {
    const user = this.authService.getCurrentUser();
    return of(user);
  }
}
