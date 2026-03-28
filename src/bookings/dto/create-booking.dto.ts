import {
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
  IsIn,
  IsBoolean,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PhoneDto {
  @IsString() deviceType: string;
  @IsString() countryCallingCode: string;
  @IsString() number: string;
}

export class TravelerNameDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
}

export class TravelerContactDto {
  @IsEmail() emailAddress: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PhoneDto) phones: PhoneDto[];
}

export class DocumentDto {
  @IsString() documentType: string;
  @IsString() number: string;
  @IsString() expiryDate: string;
  @IsString() issuanceCountry: string;
  @IsString() nationality: string;
  @IsBoolean() holder: boolean;
}

export class TravelerDto {
  @IsString() id: string;
  @IsString() dateOfBirth: string;
  @ValidateNested() @Type(() => TravelerNameDto) name: TravelerNameDto;
  @IsString() @IsIn(['MALE', 'FEMALE']) gender: 'MALE' | 'FEMALE';
  @ValidateNested() @Type(() => TravelerContactDto) contact: TravelerContactDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DocumentDto) documents?: DocumentDto[];
}

export class SeatingDto {
  @IsString() segmentId: string;
  @IsString() travelerId: string;
  @IsString() seatNumber: string;
}

export class GeneralRemarkDto {
  @IsString() subType: string;
  @IsString() text: string;
}

export class AirlineRemarkDto {
  @IsString() subType: string;
  @IsString() airlineCode: string;
  @IsString() text: string;
}

export class RemarksDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => GeneralRemarkDto) general?: GeneralRemarkDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AirlineRemarkDto) airline?: AirlineRemarkDto[];
}

export class TicketingAgreementDto {
  @IsString() @IsIn(['CONFIRM', 'DELAY_TO_CANCEL', 'DELAY_TO_QUEUE']) option: 'CONFIRM' | 'DELAY_TO_CANCEL' | 'DELAY_TO_QUEUE';
  @IsOptional() @IsString() delay?: string;
}

export class CreateBookingDto {
  @IsString() searchId: string;
  @IsString() flightId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => TravelerDto) travelers: TravelerDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SeatingDto) seatings?: SeatingDto[];
  @IsOptional() @ValidateNested() @Type(() => RemarksDto) remarks?: RemarksDto;
  @IsOptional() @ValidateNested() @Type(() => TicketingAgreementDto) ticketingAgreement?: TicketingAgreementDto;
}
