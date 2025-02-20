import { Component, effect } from '@angular/core';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [AmplifyAuthenticatorModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  public user = null;

  constructor(private authService: AuthService) {
    effect(() => {
      this.user = this.authService.user();
    });
  }
}
