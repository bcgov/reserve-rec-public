import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface cacheData {
  expiry: number | null;
  data: any;
}

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private data;

  constructor() {
    this.data = {};
  }

  initItem(id): void {
    this.data[id] = new BehaviorSubject(null);
  }

  setItemValue(id, value): void {
    if (!this.checkIfDataExists(id)) {
      this.initItem(id);
    }
    this.data[id].next(value);
  }

  // Append array data to existing dataService id
  appendItemValue(id, value): any[] {
    // We cannot concatenate an undefined object
    if (!this.checkIfDataExists(id) || !this.getItemValue(id)) {
      this.setItemValue(id, value);
      return [];
    } else {
      const appendObj = this.getItemValue(id).concat(value);
      this.data[id].next(appendObj);
      return appendObj;
    }
  }

  // Merge object data to existing dataService id
  mergeItemValue(id, value): any {
    // We cannot merge to an undefined object
    if (!this.checkIfDataExists(id) || !this.getItemValue(id)) {
      this.setItemValue(id, value);
      return null;
    } else {
      const assignObj = Object.assign(this.getItemValue(id), value);
      this.data[id].next(assignObj);
      return assignObj;
    }
  }

  public watchItem(id) {
    if (!this.checkIfDataExists(id)) {
      this.initItem(id);
    }
    return this.data[id];
  }

  public getItemValue(id) {
    if (!this.checkIfDataExists(id)) {
      this.initItem(id);
    }
    return this.data[id].value;
  }

  clearItemValue(id): void {
    this.setItemValue(id, null);
  }

  checkIfDataExists(id) {
    return this.data[id] ? true : false;
  }

  initCacheItem(id): void {
    this.data[id] = new BehaviorSubject<cacheData>({
      expiry: null,
      data: null
    });
  }

  checkIfCacheValid(id) {
    const now = Date.now();
    const expiry = this.data[id]?.value?.expiry
    if (expiry && now > expiry) {
      // cache expired
      return false;
    }
    return true;
  }

  getCachedValue(id) {
    if (!this.checkIfDataExists(id)) {
      this.initCacheItem(id);
    }
    if (this.checkIfCacheValid(id)) {
      // cache is valid
      return this.data[id].value?.data;
    }
    // cache is invalid (expired)
    return null;
  }

  setCacheValue(id, value, timeout = null) {
    if (!this.checkIfDataExists(id)) {
      this.initCacheItem(id);
    }
    const cache: cacheData = {
      data: value,
      expiry: null
    }
    if (timeout) {
      // set cache expiry
      cache.expiry = Date.now() + (timeout * 1000);
    }
    this.data[id].next(cache);
  }

}
