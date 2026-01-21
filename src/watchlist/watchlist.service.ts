import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Watchlist, WatchlistDocument } from './schemas/watchlist.schema';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';

@Injectable()
export class WatchlistService {
  constructor(
    @InjectModel(Watchlist.name) private watchlistModel: Model<WatchlistDocument>,
  ) {}

  async getWatchlist(userId: string) {
    return await this.watchlistModel.find({ user_id: userId }).exec();
  }

  async addToWatchlist(createDto: CreateWatchlistDto) {
    const exists = await this.watchlistModel.findOne({
      user_id: createDto.user_id,
      flight_number: createDto.flight_number,
    });
    if (exists) return exists;

    const created = new this.watchlistModel(createDto);
    return await created.save();
  }

  async removeFromWatchlist(userId: string, flightNumber: string) {
    const deleted = await this.watchlistModel.findOneAndDelete({
      user_id: userId,
      flight_number: flightNumber,
    }).exec();
    if (!deleted) return { message: 'Flight not found in watchlist' };
    return deleted;
  }
}
