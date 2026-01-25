// src/watchlist/watchlist.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';
import { Watchlist, WatchlistSchema } from './schemas/watchlist.schema';
import { AirlinesModule } from 'src/airlines/airlines.module';
import { FlightSearch, FlightSearchSchema } from 'src/flights/schemas/flight.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Watchlist', schema: WatchlistSchema },
      { name: FlightSearch.name, schema: FlightSearchSchema }
    ]),
    AirlinesModule
  ],
  controllers: [WatchlistController],
  providers: [WatchlistService],
})
export class WatchlistModule {}
