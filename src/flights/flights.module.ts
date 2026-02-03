import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import FlightsController from './flights.controller';
import { FlightsService } from './flights.service';
import { FlightSearch, FlightSearchSchema } from './schemas/flight.schema';
import { AirlinesModule } from 'src/airlines/airlines.module';
import { GeminiModule } from 'src/gemini/gemini.module'; // ADD THIS IMPORT

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: FlightSearch.name, schema: FlightSearchSchema },
    ]),
    AirlinesModule,
    GeminiModule,
  ],
  controllers: [FlightsController],
  providers: [FlightsService],
  exports: [FlightsService],
})
export class FlightsModule {}