import { IsNotEmpty, IsNumber, IsString, IsOptional, IsArray, IsDateString } from 'class-validator';

export class FlightPredictionDTO {
  @IsNotEmpty()
  @IsString()
  route: string; // e.g., "SGN-YYZ"

  @IsNotEmpty()
  @IsNumber()
  currentPrice: number;

  @IsNotEmpty()
  @IsDateString()
  departureDate: string;

  @IsOptional()
  @IsArray()
  historicalPrices?: number[];
}

export class BatchFlightPredictionDTO {
  @IsNotEmpty()
  @IsArray()
  flights: FlightPredictionDTO[];
}

export class PredictionResponseDTO {
  recommendation: 'BUY_NOW' | 'WAIT';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}
