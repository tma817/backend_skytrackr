import { Module } from '@nestjs/common';
import { WatchlistService } from './watchlist.service';

@Module({
  providers: [WatchlistService]
})
export class WatchlistModule {}
