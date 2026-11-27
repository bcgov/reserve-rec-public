import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from "@angular/router";
import { AuthService } from "../services/auth.service";

@Injectable({
    providedIn: 'root',
}) export class LoginGuard implements CanActivate {
    constructor(
        private authService: AuthService,
        private router: Router
    ) {}

    async canActivate(route?: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
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
        // router.url is still the page the user left. Protected routes save
        // their own returnUrl and ask us to keep it; otherwise replace any
        // left over from an abandoned login.
        const from = this.router.url;
        // The standalone waiting room page arrives by full page load, so it can't pass state.
        const keep = this.router.getCurrentNavigation()?.extras.state?.['keepReturnUrl']
            || route?.queryParamMap.get('reason') === 'waiting-room';
        if (!keep && !from.startsWith('/login')) {
            if (from === '/') {
                sessionStorage.removeItem('returnUrl');
            } else {
                sessionStorage.setItem('returnUrl', from);
            }
        }

        return true;
    }

}