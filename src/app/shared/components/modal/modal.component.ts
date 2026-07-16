import { Component, Input } from '@angular/core';
import { BsModalService } from 'ngx-bootstrap/modal';


export interface modalSchema {
  id: string;
  title: string;
  body: any;
  buttons?: modalButtonSchema[];
}

export interface modalButtonSchema {
  text: string;
  classes?: string;
  onClick: (event?: any) => void;
}

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
  imports: []
})
export class ModalComponent {
  @Input() modal: modalSchema;

  constructor(
    private modalService: BsModalService
  ) { }

  close() {
    this.modalService.hide()
  }

}
