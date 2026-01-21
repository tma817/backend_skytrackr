import { Controller, Get, Post, Body, Delete, Param } from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';

@Controller('watchlist')
export class WatchlistController {
    constructor(private readonly watchlistService: WatchlistService) {}

    @Get()
    async getAll() {
        return await this.watchlistService.findAll();
    }

    @Post()
    async addFlight(@Body() flight: CreateWatchlistDto) {
        return await this.watchlistService.add(flight);
    }
    
    @Delete(':id')
    async removeFlight(@Param('id') id: string) {
        return await this.watchlistService.remove(id)
    }
}