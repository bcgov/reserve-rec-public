import { Component, OnInit } from '@angular/core';
import { ConfigService } from '../services/config.service';

@Component({
    selector: 'app-footer',
    imports: [],
    templateUrl: './footer.component.html',
    styleUrl: './footer.component.scss'
})
export class FooterComponent implements OnInit {
  public GH_HASH: string;
  constructor(private configService: ConfigService) {
  }
  ngOnInit() {
    this.GH_HASH = this.configService.config.GH_HASH;
  }
}
