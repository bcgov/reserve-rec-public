import { Injectable } from "@angular/core";
import { CanActivate, Router, UrlTree } from "@angular/router";
import { AuthService } from "../services/auth.service";

@Injectable({
    providedIn: 'root',
}) export class LoginGuard implements CanActivate {
    constructor(
        private authService: AuthService,
        private router: Router
    ) {}

    async canActivate(): Promise<boolean | UrlTree> {
        // The user signal only knows about sign-ins made in this tab. Ask Amplify
        // again so a session started in another tab skips the login page (#796).
        if (!this.authService.user()) {
            await this.authService.checkIfSignedIn();
            // Same follow-up as app start: swap in the access token the API expects.
            if (this.authService.user()) {
                await this.authService.setRefresh();
            }
        }
        if (this.authService.user()) {
            return this.router.parseUrl('/');
        }

        // Plain Log in links save nothing, so sign-in landed on home (#989).
        // router.url is still the page the user left. A protected route's
        // guard saves its own returnUrl first; keep that one.
        const from = this.router.url;
        if (!sessionStorage.getItem('returnUrl') && from !== '/' && !from.startsWith('/login')) {
            sessionStorage.setItem('returnUrl', from);
        }

        return true;
    }

}