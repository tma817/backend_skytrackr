import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWatchlistDto {
  @ApiProperty({ example: '6974076bef0e0ccf514f6300' })
  @IsString()
  searchId: string;

  @ApiProperty({ example: '1' })
  @IsString()
  flightId: string;

  @ApiProperty({ example: 'YYZ' })
  @IsString()
  origin: string;

  @ApiProperty({ example: 'HNL' })
  @IsString()
  destination: string;

  @ApiProperty({ example: 395 })
  @Type(() => Number)
  @IsNumber()
  initialPrice: number;

  @ApiProperty({ example: '2026-02-22' })
  @IsString()
  departureDate: string;

  @ApiProperty({ example: '2026-03-30', required: false })
  @IsOptional()
  @IsString()
  returnDate?: string;

  @ApiProperty({ example: '08:00', required: false })
  @IsOptional()
  @IsString()
  departureTime?: string;

  @ApiProperty({ example: '14:00', required: false })
  @IsOptional()
  @IsString()
  returnTime?: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  passengers: number;

  @ApiProperty({ example: 'round-trip' })
  @IsIn(['one-way', 'round-trip'])
  tripType: string;

  @ApiProperty({ example: 'Air Canada', required: false })
  @IsOptional()
  @IsString()
  airlineName?: string;

  @ApiProperty({ example: 'https://...', required: false })
  @IsOptional()
  @IsString()
  airlineLogo?: string;

  @ApiProperty({ example: 'CAD', required: false })
  @IsOptional()
  @IsString()
  currency?: string;
}
