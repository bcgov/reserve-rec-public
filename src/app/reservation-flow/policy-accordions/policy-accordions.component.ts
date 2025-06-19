import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-policy-accordions',
  imports: [],
  templateUrl: './policy-accordions.component.html',
  styleUrl: './policy-accordions.component.scss'
})
export class PolicyAccordionsComponent {
  @Input() activityName: string | null = null;

}
