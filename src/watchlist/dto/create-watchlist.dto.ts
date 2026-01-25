import { ApiProperty } from '@nestjs/swagger';

export class CreateWatchlistDto {
  @ApiProperty({ example: '6974076bef0e0ccf514f6300' })
  searchId: string;

  @ApiProperty({ example: '1' })
  flightId: string;

  @ApiProperty({ example: 'YYZ' })
  origin: string;

  @ApiProperty({ example: 'HNL' })
  destination: string;

  @ApiProperty({ example: 395 })
  initialPrice: number;

  @ApiProperty({ example: '2026-02-22' })
  departureDate: string;

  @ApiProperty({ example: 'China United Airlines' })
  airlineName: string;
}