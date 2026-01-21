import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FlightsService } from './flights.service';
import FlightsController from './flights.controller';

@Module({
  imports: [HttpModule],
  controllers: [FlightsController],
  providers: [FlightsService],
})
export class FlightsModule {}