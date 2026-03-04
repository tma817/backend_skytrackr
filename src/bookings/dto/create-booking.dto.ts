export class PhoneDto {
  deviceType: string;        // e.g. 'MOBILE'
  countryCallingCode: string; // e.g. '1'
  number: string;
}

export class DocumentDto {
  documentType: string;      // e.g. 'PASSPORT'
  number: string;
  expiryDate: string;        // 'YYYY-MM-DD'
  issuanceCountry: string;   // e.g. 'CA'
  nationality: string;       // e.g. 'CA'
  holder: boolean;
}

export class TravelerDto {
  id: string;                // '1', '2', etc. (must match adults count)
  dateOfBirth: string;       // 'YYYY-MM-DD'
  name: {
    firstName: string;
    lastName: string;
  };
  gender: 'MALE' | 'FEMALE';
  contact: {
    emailAddress: string;
    phones: PhoneDto[];
  };
  documents: DocumentDto[];
}

export class SeatingDto {
  segmentId: string;
  travelerId: string;
  seatNumber: string;
}

export class GeneralRemarkDto {
  subType: string;  // e.g. 'GENERAL_MISCELLANEOUS'
  text: string;
}

export class AirlineRemarkDto {
  subType: string;  // e.g. 'OTHER_SERVICE_INFORMATION'
  airlineCode: string;
  text: string;
}

export class RemarksDto {
  general?: GeneralRemarkDto[];
  airline?: AirlineRemarkDto[];
}

export class TicketingAgreementDto {
  option: 'CONFIRM' | 'DELAY_TO_CANCEL' | 'DELAY_TO_QUEUE';
  delay?: string;  // e.g. '6D' — required when option is DELAY_TO_CANCEL or DELAY_TO_QUEUE
}

export class CreateBookingDto {
  searchId: string;                          // MongoDB _id from the flight search
  flightId: string;                          // Amadeus flight offer id
  travelers: TravelerDto[];
  seatings?: SeatingDto[];
  remarks?: RemarksDto;
  ticketingAgreement?: TicketingAgreementDto;
}
