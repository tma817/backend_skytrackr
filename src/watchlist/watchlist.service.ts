import { Injectable } from '@nestjs/common';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';

@Injectable()
export class WatchlistService {
    private watchlist: CreateWatchlistDto[] = [];

    async findAll() {
        return this.watchlist;
    }

    async add(flight: CreateWatchlistDto) {
        this.watchlist.push(flight);
        return flight;
    }

    async remove(flightId: string) {
        const index = this.watchlist.findIndex(f => f.flightId === flightId);
        if (index === -1) return { message: 'Flight not found'};
        const removed = this.watchlist.splice(index, 1);
        return removed[0];
    }
}
