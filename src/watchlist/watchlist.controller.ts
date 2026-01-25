import { Controller, Get, Post, Body, Delete, Param, UseGuards, Request, Req } from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.gaurd';

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
@ApiBearerAuth()      
@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Add flight to watchlist' })
  async create(@Request() req ,@Body() createDto: CreateWatchlistDto) {
    const userId = req.user.userId
    return this.watchlistService.create(userId, createDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get all the flights by user from watchlist' })
  async findAll(@Request() req) {
    return this.watchlistService.findAllByUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete flight from watch list' })
  async remove(@Request() req, @Param('id') id: string) {
    const userId = req.user.userId
    return this.watchlistService.remove(userId, id);
  }
}