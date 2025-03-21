import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ProfileOffcanvasComponent } from '../profile-offcanvas/profile-offcanvas.component';
import { SearchBarComponent } from "../search-bar/search-bar.component";


@Component({
    selector: 'app-header',
    imports: [CommonModule, ProfileOffcanvasComponent, SearchBarComponent],
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss'
})
export class HeaderComponent { }

// add the token to endpoint calls
// write the form property in angular
