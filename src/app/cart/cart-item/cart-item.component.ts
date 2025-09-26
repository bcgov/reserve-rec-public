import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartItem } from '../../services/cart.service';

@Component({
  selector: 'app-cart-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart-item.component.html',
  styleUrl: './cart-item.component.scss'
})
export class CartItemComponent {
  @Input() item!: CartItem;
  @Output() removeItem = new EventEmitter<string>();

  getTotalOccupants(occupants: any): number {
    return occupants.totalAdult + occupants.totalSenior + 
           occupants.totalYouth + occupants.totalChild;
  }

  calculateNights(): number {
    const startDate = new Date(this.item.startDate);
    const endDate = new Date(this.item.endDate);
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  }

  onRemoveClick(): void {
    this.removeItem.emit(this.item.id);
  }

calculateAdultCost(): number {
  const adultRate = 0; // GET THIS FROM FEE REG
  return this.calculateNights() * this.item.occupants.totalAdult * adultRate;
}

calculateSeniorCost(): number {
  const seniorRate = 0; // GET THIS FROM FEE REG
  return this.calculateNights() * this.item.occupants.totalSenior * seniorRate;
}

calculateYouthCost(): number {
  const youthRate = 0; // GET THIS FROM FEE REG
  return this.calculateNights() * this.item.occupants.totalYouth * youthRate;
}

calculateChildCost(): number {
  const childRate = 0; // GET THIS FROM FEE REG
  return this.calculateNights() * this.item.occupants.totalChild * childRate;
}

calculateSubtotal(): number {
  return this.calculateAdultCost() + this.calculateSeniorCost() + 
         this.calculateYouthCost() + this.calculateChildCost();
}

onEditClick(): void {
  console.log('No one has determined how edit will function. Edit clicked for item:', this.item.id);
}

}