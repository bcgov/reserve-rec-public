import { Component, Input } from '@angular/core';

export interface AccountInfoPhone {
  label?: string;
  value: string;
}

export interface AccountInfo {
  fullName: string;
  email: string;
  addressLines: string[];
  phoneHeading: string;
  phones: AccountInfoPhone[];
}

@Component({
  selector: 'app-account-info',
  standalone: true,
  imports: [],
  templateUrl: './account-info.component.html',
  styleUrl: './account-info.component.scss'
})
export class AccountInfoComponent {
  @Input() info: AccountInfo = {
    fullName: '',
    email: '',
    addressLines: [],
    phoneHeading: 'Phone number',
    phones: []
  };
}
