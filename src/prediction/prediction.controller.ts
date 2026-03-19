import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PredictionService } from './prediction.service';
import { PredictPriceDto } from './dto/predict-price.dto';

@ApiTags('prediction')
@Controller('prediction')
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Get('price')
  @ApiOperation({ summary: 'Predict flight price using AI' })
  async predictPrice(@Query() dto: PredictPriceDto) {
    return this.predictionService.predictPrice(
      dto.origin,
      dto.destination,
      dto.departureDate,
      dto.currency,
    );
  }
}
