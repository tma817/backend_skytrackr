import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PredictPriceDto {
  @ApiProperty({ example: 'YYZ' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (value as string).toUpperCase())
  origin: string;

  @ApiProperty({ example: 'LAX' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (value as string).toUpperCase())
  destination: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'departureDate must be YYYY-MM-DD' })
  departureDate: string;

  @ApiPropertyOptional({ example: 'CAD', default: 'CAD' })
  @IsOptional()
  @IsString()
  currency?: string = 'CAD';
}
