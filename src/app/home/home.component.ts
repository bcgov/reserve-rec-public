import { Component } from '@angular/core';
import { SearchPageComponent } from '../search-page/search-page.component';

@Component({
    selector: 'app-home',
    imports: [SearchPageComponent],
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss'
})
export class HomeComponent { }
