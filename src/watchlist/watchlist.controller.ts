import { Controller, Get, Post, Body, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

// @Controller('watchlist')
// export class WatchlistController {
//   constructor(private readonly watchlistService: WatchlistService) {}

//   @Get(':userId')
//   async getWatchlist(@Param('userId') userId: string) {
//     return await this.watchlistService.getWatchlist(userId);
//   }

//   @Post()
//   async addFlight(@Body() createDto: CreateWatchlistDto) {
//     return await this.watchlistService.addToWatchlist(createDto);
//   }

//   @Delete(':flightNumber/:userId')
//   async removeFlight(
//     @Param('flightNumber') flightNumber: string,
//     @Param('userId') userId: string,
//   ) {
//     return await this.watchlistService.removeFromWatchlist(userId, flightNumber);
//   }
// }


@ApiTags('watchlist')
// @ApiBearerAuth()      
@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  // @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Add flight to watchlist' })
  async create(@Body() createDto: CreateWatchlistDto & { userId: string }) {
    return this.watchlistService.create(createDto.userId, createDto);
  }

  // @UseGuards(JwtAuthGuard)
  @Get(':userId')
  @ApiOperation({ summary: 'Get all the flights by user from watchlist' })
  async findAll(@Param('userId') userId: string) {
    return this.watchlistService.findAllByUser(userId);
  }

  // @UseGuards(JwtAuthGuard)
  @Delete(':id/:userId')
  @ApiOperation({ summary: 'Delete flight from watch list' })
  async remove(@Param('userId') userId: string, @Param('id') id: string) {
    return this.watchlistService.remove(userId, id);
  }
}