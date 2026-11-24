export interface BookingCompletionDetails {
  namedOccupant: {
    contactInfo: {
      streetAddress: string;
      city: string;
      postalCode: string;
      province: string;
      country: string;
    };
  };
  vehicleInformation: {
    licensePlate: string;
    licensePlateRegistrationRegion: string;
  }[];
  equipmentInformation: string;
  smsOptIn: boolean;
}

// Identity fields (firstName, lastName, email, mobilePhone) are resolved
// server-side from the authenticated Cognito sub — the FE must not send
// them or the booking can be made to carry another user's identity
// (Ref #480). Address fields stay client-provided since Cognito does not
// reliably carry them for BCSC users.
export function getBookingCompletionDetails(formValue: any): BookingCompletionDetails {
  const addressInfo = formValue?.addressInfo || {};
  const equipmentInfo = formValue?.equipmentInfo || {};
  const licensePlate = (equipmentInfo.licensePlate || '').trim();
  const registeredProvince = (equipmentInfo.registeredProvince || '').trim();

  return {
    namedOccupant: {
      contactInfo: {
        streetAddress: addressInfo.streetAddress || '',
        city: addressInfo.city || '',
        postalCode: addressInfo.postalCode || '',
        province: addressInfo.province || '',
        country: addressInfo.country || ''
      }
    },
    vehicleInformation: licensePlate || registeredProvince
      ? [{ licensePlate, licensePlateRegistrationRegion: registeredProvince }]
      : [],
    equipmentInformation: formValue?.equipmentDetails || formValue?.additionalEquipment || '',
    smsOptIn: Boolean(formValue?.smsOptIn)
  };
}
