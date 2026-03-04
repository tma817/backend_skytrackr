import { IsOptional, IsString, IsInt, Min, IsNumber, IsBoolean, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum TravelClass {
  ECONOMY = 'ECONOMY',
  PREMIUM_ECONOMY = 'PREMIUM_ECONOMY',
  BUSINESS = 'BUSINESS',
  FIRST = 'FIRST',
}

export class SearchFlightsDto {
  // SEARCH PARAMS
  @IsOptional() @IsString() @Transform(({ value }) => value?.toUpperCase()) origin?: string;
  @IsOptional() @IsString() @Transform(({ value }) => value?.toUpperCase()) destination?: string;
  @IsOptional() @IsString() departureDate?: string;
  @IsOptional() @IsString() returnDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) adults?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) children?: number;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsEnum(TravelClass) travelClass?: TravelClass;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) max?: number;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() nonStop?: boolean;
  @IsOptional() @IsString() includedAirlineCodes?: string;
  @IsOptional() @IsString() excludedAirlineCodes?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() includedCheckedBagsOnly?: boolean;
  @IsOptional() @IsString() excludedAlliances?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;

  // FILTERS
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stops?: number;
  @IsOptional() @IsString() airline?: string;
  @IsOptional() @IsString() cabin?: string;
  @IsOptional() @IsString() timeFrom?: string;
  @IsOptional() @IsString() timeTo?: string;

  @IsOptional() @IsString() searchId?: string;
}
