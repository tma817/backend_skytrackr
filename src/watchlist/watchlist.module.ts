// src/watchlist/watchlist.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';
import { Watchlist, WatchlistSchema } from './schemas/watchlist.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Watchlist.name, schema: WatchlistSchema }]),
  ],
  controllers: [WatchlistController],
  providers: [WatchlistService],
})
export class WatchlistModule {}
