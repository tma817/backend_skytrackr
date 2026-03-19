import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';
import { Watchlist, WatchlistSchema } from './schemas/watchlist.schema';
import { PriceHistory, PriceHistorySchema } from './schemas/price-history.schema';
import { AirlinesModule } from 'src/airlines/airlines.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: Watchlist.name, schema: WatchlistSchema },
      { name: PriceHistory.name, schema: PriceHistorySchema },
    ]),
    AirlinesModule,
    MailModule,
  ],
  controllers: [WatchlistController],
  providers: [WatchlistService],
})
export class WatchlistModule {}
