import { ActivatedRoute, RouterLink } from '@angular/router';
import { BookingMainCardComponent } from './bookings-main-card/bookings-main-card.component'
import { BreadcrumbComponent } from '../shared/breadcrumb/breadcrumb.component';
import { Component, effect, OnInit } from '@angular/core';

import { DateTime } from 'luxon'
import { lastValueFrom } from 'rxjs';

import { ApiService } from '../services/api.service';
import { BookingService } from '../services/booking.service';
import { BookingUtils } from '../utils/booking-utils';
import { Constants } from '../constants';
import { DataService } from '../services/data.service';
import { LoadingService } from '../services/loading.service';

@Component({
  selector: 'app-my-bookings',
  imports: [BookingMainCardComponent, BreadcrumbComponent, RouterLink],
  templateUrl: './my-bookings.component.html',
  styleUrls: ['./my-bookings.component.scss']
})
export class MyBookingsComponent implements OnInit {
  public activeBookings: any[] = [];
  public upcomingBookings: any[] = [];
  public pastBookings: any[] = [];
  public cancelledBookings: any[] = [];

  // The same component serves /my-bookings and /my-bookings/previous.
  public previousMode = false;
  public previousTab: 'completed' | 'cancelled' = 'completed';

  public data: any[] = [];
  public loading = true;
  public today: DateTime = this.getPSTDateTime();
  public user: { sub: string };

  // Bookings don't carry the park image or the pass sub-type, so they're looked
  // up once per collection/activity and cached for the life of the component.
  private geozoneImages = new Map<string, string>();
  private activitySubTypes = new Map<string, string>();
  
  constructor(
    private route: ActivatedRoute,
    private loadingService: LoadingService,
    private bookingService: BookingService,
    private dataService: DataService,
    private apiService: ApiService,
  ) {
    effect(() => {
      this.loading = this.loadingService.isLoading();
      this.processBookings();
    });
  }

  ngOnInit(): void {
    this.previousMode = this.route.snapshot.data['previous'] === true;

    this.clearBookings();
    this.dataService.clearItemValue(Constants.dataIds.MY_BOOKINGS_RESULT);

    this.user = this.route.snapshot.data['user'] || {};
    this.bookingService.getBookings(this.user.sub);
  }

  clearBookings(): void {
    this.data = [];
    this.activeBookings = [];
    this.upcomingBookings = [];
    this.pastBookings = [];
    this.cancelledBookings = [];
  }

  // Get today's date e.g. 2025-05-30T16:24:48.872-08:00
  getPSTDateTime() {
    return DateTime.now().setZone('America/Vancouver');
  }

  hasData(obj: any): boolean {
    return obj && Object.keys(obj).length !== 0;
  }

  // Check if there are any bookings to show
  hasAnyBookings(): boolean {
    return this.activeBookings.length > 0 || this.upcomingBookings.length > 0 || this.pastBookings.length > 0 || this.cancelledBookings.length > 0;
  }

  // Format the date e.g. Fri, May 30, 2025
  formatDate(dateString: string): string {
    const dt = DateTime.fromISO(dateString);
    const day = dt.day;
    return `${dt.toFormat('EEE, MMM')} ${day}, ${dt.toFormat('yyyy')}`;
  }

  // Take all bookings and calculate which are active (future, not cancelled), past (past, not cancelled), cancelled (any cancelled), or other (catch-all)
  processBookings(): void {
    this.activeBookings = [];
    this.upcomingBookings = [];
    this.pastBookings = [];
    this.cancelledBookings = [];

    const result = this.dataService.watchItem(Constants.dataIds.MY_BOOKINGS_RESULT)();
    
    // Extract the items array from the result object
    if (result && result.items && Array.isArray(result.items)) {
      this.data = result.items;
    } else if (Array.isArray(result)) {
      this.data = result;
    } else {
      this.data = [];
      return;
    }

    // Filter to only process booking schema items (not bookingDate aggregates)
    const allBookings = this.data.filter(item => item.schema === 'booking');

    // A booking still 'in progress' is an unfinished checkout, not something the
    // visitor holds, so it is not shown on this page at all.
    const bookings = allBookings.filter(item => !BookingUtils.isInProgress(item));

    bookings.forEach(item => {
      const rangeStart = DateTime.fromISO(item.startDate).startOf('day');
      const rangeEnd = DateTime.fromISO(item.endDate).endOf('day');
      const isCancelled = BookingUtils.isCancelled(item);
      const hasEnded = this.today > rangeEnd;
      const hasStarted = this.today >= rangeStart;

      // Get the display name of the activity type from constants
      const activityType = Constants.activityTypes?.[item.activityType]?.display || BookingUtils.getActivityType(item);

      const booking = {
        bookingId: item.bookingId || item.globalId,
        geozoneName: BookingUtils.getGeozoneName(item),
        facilityName: BookingUtils.getFacilityName(item),
        productName: BookingUtils.getProductDisplayName(item),
        activityType: activityType,
        passType: this.getPassType(item),
        imageUrl: item.geozoneImageUrl || this.geozoneImages.get(item.collectionId) || '',
        startDate: item.startDate,
        endDate: item.endDate,
        formattedDate: this.formatDateRange(item),
        isCancelled: isCancelled,
        status: BookingUtils.getStatus(item)
      };

      // Categorize bookings:
      // 1. Cancelled - any cancelled booking
      // 2. Past - already ended
      // 3. Active - happening now (today falls inside the booking's date range)
      // 4. Upcoming - starts after today
      if (isCancelled) {
        this.cancelledBookings.push(booking);
      } else if (hasEnded) {
        this.pastBookings.push(booking);
      } else if (hasStarted) {
        this.activeBookings.push(booking);
      } else {
        this.upcomingBookings.push(booking);
      }

      this.loading = false;
    });

    this.enrichBookings(bookings);

    // Active/upcoming ascending (soonest first); past/cancelled descending (most recent first)
    this.activeBookings.sort((a, b) => DateTime.fromISO(a.startDate).toMillis() - DateTime.fromISO(b.startDate).toMillis());
    this.upcomingBookings.sort((a, b) => DateTime.fromISO(a.startDate).toMillis() - DateTime.fromISO(b.startDate).toMillis());
    this.pastBookings.sort((a, b) => DateTime.fromISO(b.startDate).toMillis() - DateTime.fromISO(a.startDate).toMillis());
    this.cancelledBookings.sort((a, b) => DateTime.fromISO(b.startDate).toMillis() - DateTime.fromISO(a.startDate).toMillis());
  }

  // Pass sub-type display, e.g. "Trail pass". Older bookings carry the
  // sub-type inline; the rest resolve it from the cached activity lookup.
  getPassType(item: any): string {
    const subType = item.activitySubType
      || this.activitySubTypes.get(`${item.collectionId}::${item.activityType}::${item.activityId}`);
    return Constants.activityTypes?.[item.activityType]?.subTypes?.[subType]?.display || '';
  }

  // Fill in the park image and pass sub-type the bookings endpoint doesn't return.
  // Cards render immediately; these fields appear once the lookups resolve.
  async enrichBookings(items: any[]): Promise<void> {
    const collections = [...new Set(items.map(item => item.collectionId).filter(Boolean))];
    const activities = [...new Set(items.map(item => `${item.collectionId}::${item.activityType}`).filter(key => !key.includes('undefined')))];

    await Promise.all([
      ...collections.map(collectionId => this.loadGeozoneImage(collectionId)),
      ...activities.map(key => this.loadActivitySubTypes(...key.split('::') as [string, string])),
    ]);

    for (const list of [this.activeBookings, this.upcomingBookings, this.pastBookings, this.cancelledBookings]) {
      for (const booking of list) {
        const item = items.find(i => (i.bookingId || i.globalId) === booking.bookingId);
        if (!item) continue;
        booking.imageUrl = booking.imageUrl || this.geozoneImages.get(item.collectionId) || '';
        booking.passType = booking.passType || this.getPassType(item);
      }
    }
  }

  // The park image lives on the geozone, reachable only through a facility.
  private async loadGeozoneImage(collectionId: string): Promise<void> {
    if (this.geozoneImages.has(collectionId)) {
      return;
    }
    this.geozoneImages.set(collectionId, '');
    try {
      const facilities = (await lastValueFrom(this.apiService.get(`facilities/${collectionId}`)))['data']?.items || [];
      const facility = facilities[0];
      if (!facility) {
        return;
      }
      const detail = (await lastValueFrom(this.apiService.get(`facilities/${collectionId}`, {
        facilityType: facility.facilityType,
        facilityId: facility.facilityId,
        fetchGeozones: true,
      })))['data'];
      this.geozoneImages.set(collectionId, detail?.geozones?.[0]?.imageUrl || '');
    } catch {
      // The image is decorative - a failed lookup just leaves the card without one.
    }
  }

  private async loadActivitySubTypes(collectionId: string, activityType: string): Promise<void> {
    const cacheKey = `${collectionId}::${activityType}`;
    if (this.activitySubTypes.has(cacheKey)) {
      return;
    }
    this.activitySubTypes.set(cacheKey, '');
    try {
      const activities = (await lastValueFrom(this.apiService.get(`activities/${collectionId}`, { activityType })))['data']?.items || [];
      for (const activity of activities) {
        this.activitySubTypes.set(`${collectionId}::${activityType}::${activity.activityId}`, activity.activitySubType || '');
      }
    } catch {
      // Without the sub-type the card just omits it.
    }
  }

  // Format the booking date, e.g. "Jul 31, 2025" or "Jul 31, 2025 - Aug 5, 2025".
  // The pass type is shown on its own line, so no time-of-day suffix here.
  formatDateRange(item: any): string {
    const start = DateTime.fromISO(item.startDate);
    const end = DateTime.fromISO(item.endDate);
    return start.hasSame(end, 'day')
      ? start.toFormat('MMM d, yyyy')
      : `${start.toFormat('MMM d, yyyy')} - ${end.toFormat('MMM d, yyyy')}`;
  }
}
