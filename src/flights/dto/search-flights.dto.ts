import { IsOptional, IsString, IsInt, Min, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchFlightsDto {
  // SEARCH PARAMS
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() date?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) adults?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;

  // FILTERS
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number; // decimal allowed
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stops?: number; // 0 = direct flight
  @IsOptional() @IsString() airline?: string; // IATA code
  @IsOptional() @IsString() cabin?: string; // ECONOMY, BUSINESS, etc.
  @IsOptional() @IsString() timeFrom?: string; // HH:mm
  @IsOptional() @IsString() timeTo?: string; // HH:mm
}
