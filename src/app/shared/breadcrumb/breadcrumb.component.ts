import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, distinctUntilChanged } from 'rxjs/operators';

interface Breadcrumb {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class BreadcrumbComponent implements OnInit {
  breadcrumbs: Breadcrumb[] = [];

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.breadcrumbs = this.buildBreadcrumbs(this.activatedRoute.root);

    // Update breadcrumbs on navigation
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.breadcrumbs = this.buildBreadcrumbs(this.activatedRoute.root);
      });
  }

  goBack(): void {
    // Navigate to the previous breadcrumb (second to last)
    if (this.breadcrumbs.length > 1) {
      const previousBreadcrumb = this.breadcrumbs[this.breadcrumbs.length - 2];
      this.router.navigate([previousBreadcrumb.url]);
    } else {
      // If only Home breadcrumb, navigate to home
      this.router.navigate(['/']);
    }
  }

  private buildBreadcrumbs(
    route: ActivatedRoute,
    url = '',
    breadcrumbs: Breadcrumb[] = []
  ): Breadcrumb[] {
    // Always start with Home
    if (breadcrumbs.length === 0) {
      breadcrumbs.push({ label: 'Home', url: '/' });
    }

    // Get the child routes
    const children: ActivatedRoute[] = route.children;

    // Return if there are no more children
    if (children.length === 0) {
      return breadcrumbs;
    }

    // Iterate over each child
    for (const child of children) {
      // Skip if route has skipBreadcrumb flag
      if (child.snapshot.data['skipBreadcrumb']) {
        return this.buildBreadcrumbs(child, url, breadcrumbs);
      }

      // Get the route's URL segment
      const routeURL: string = child.snapshot.url
        .map(segment => segment.path)
        .join('/');

      // Append route URL to URL
      if (routeURL !== '') {
        url += `/${routeURL}`;
      }

      // Check if route has a parent breadcrumb configured
      const parentBreadcrumb = child.snapshot.data['parentBreadcrumb'];
      if (parentBreadcrumb && !breadcrumbs.some(b => b.label === parentBreadcrumb.label)) {
        breadcrumbs.push(parentBreadcrumb);
      }

      // Get breadcrumb label from route data
      const label = child.snapshot.data['breadcrumb'];

      // Add breadcrumb if label exists and isn't already added
      if (label && !breadcrumbs.some(b => b.label === label)) {
        breadcrumbs.push({ label, url });
      }

      // Recursive call for child routes
      return this.buildBreadcrumbs(child, url, breadcrumbs);
    }

    return breadcrumbs;
  }
}
