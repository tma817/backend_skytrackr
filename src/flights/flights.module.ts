import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FlightsService } from './flights.service';
import FlightsController from './flights.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightSearch, FlightSearchSchema } from './schemas/flight.schema';
import { PriceGrid, PriceGridSchema } from './schemas/price-grid.schema';
import { AirlinesService } from 'src/airlines/airlines.service';
import { AirlinesModule } from 'src/airlines/airlines.module';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: FlightSearch.name, schema: FlightSearchSchema },
      { name: PriceGrid.name, schema: PriceGridSchema },
    ]),
    AirlinesModule
  ],
  controllers: [FlightsController],
  providers: [FlightsService],
  exports: [FlightsService, MongooseModule],
})
export class FlightsModule {}