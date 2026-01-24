import { Controller, Get, Post, Body, Delete, Param } from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';

@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get(':userId')
  async getWatchlist(@Param('userId') userId: string) {
    return await this.watchlistService.getWatchlist(userId);
  }

  @Post()
  async addFlight(@Body() createDto: CreateWatchlistDto) {
    return await this.watchlistService.addToWatchlist(createDto);
  }

  @Delete(':flightNumber/:userId')
  async removeFlight(
    @Param('flightNumber') flightNumber: string,
    @Param('userId') userId: string,
  ) {
    return await this.watchlistService.removeFromWatchlist(userId, flightNumber);
  }
}
