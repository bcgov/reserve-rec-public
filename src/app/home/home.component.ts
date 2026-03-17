import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { SearchPageComponent } from '../search-page/search-page.component';

@Component({
    selector: 'app-home',
    imports: [SearchPageComponent],
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss'
})
export class HomeComponent implements OnDestroy {

    constructor(
        private cd: ChangeDetectorRef
    ) { }

    ngOnDestroy(): void {
        this.cd.detectChanges();
        this.cd.detach();
    }
}
