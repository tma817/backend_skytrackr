import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { PriceHistory, PriceHistorySchema } from 'src/watchlist/schemas/price-history.schema';
import { PriceGrid, PriceGridSchema } from 'src/flights/schemas/price-grid.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PriceHistory.name, schema: PriceHistorySchema },
      { name: PriceGrid.name, schema: PriceGridSchema },
    ]),
  ],
  controllers: [PredictionController],
  providers: [PredictionService],
})
export class PredictionModule {}
