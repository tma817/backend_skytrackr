// import { Injectable } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { Watchlist, WatchlistDocument } from './schemas/watchlist.schema';
// import { CreateWatchlistDto } from './dto/create-watchlist.dto';

// @Injectable()
// export class WatchlistService {
//   constructor(
//     @InjectModel(Watchlist.name) private watchlistModel: Model<WatchlistDocument>,
//   ) {}

//   async getWatchlist(userId: string) {
//     return await this.watchlistModel.find({ user_id: userId }).exec();
//   }

//   async addToWatchlist(createDto: CreateWatchlistDto) {
//     const exists = await this.watchlistModel.findOne({
//       user_id: createDto.user_id,
//       flight_number: createDto.flight_number,
//     });
//     if (exists) return exists;

//     const created = new this.watchlistModel(createDto);
//     return await created.save();
//   }

//   async removeFromWatchlist(userId: string, flightNumber: string) {
//     const deleted = await this.watchlistModel.findOneAndDelete({
//       user_id: userId,
//       flight_number: flightNumber,
//     }).exec();
//     if (!deleted) return { message: 'Flight not found in watchlist' };
//     return deleted;
//   }
// }
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Watchlist } from './schemas/watchlist.schema';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { AirlinesService } from 'src/airlines/airlines.service';
import { FlightSearch } from 'src/flights/schemas/flight.schema';

@Injectable()
export class WatchlistService {
  constructor(
    @InjectModel(Watchlist.name) private watchlistModel: Model<Watchlist>,
    @InjectModel(FlightSearch.name) private flightSearchModel: Model<FlightSearch>,
    private readonly airlinesService: AirlinesService,
  ) {}

  async create(userId: string, dto: CreateWatchlistDto): Promise<Watchlist> {
    const existing = await this.watchlistModel.findOne({
      userId: new Types.ObjectId(userId),
      origin: dto.origin,
      destination: dto.destination,
      departureDate: dto.departureDate,
    });

    if (existing) {
      throw new BadRequestException('You are already watching this route!');
    }

    const newItem = new this.watchlistModel({
      ...dto,
      userId: new Types.ObjectId(userId),
      currentPrice: dto.initialPrice,
    });

    return newItem.save();
  }

  async findAllByUser(userId: string): Promise<any[]> {
    const watchlistItems = await this.watchlistModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();

    return Promise.all(
      watchlistItems.map(async (item) => {
        const searchDoc = await this.flightSearchModel.findById(item.searchId).lean();
        
        const rawFlight = searchDoc?.results?.find(
          (f: any) => f.id === item.flightId
        );

        if (!rawFlight) {
          return {
            _id: item._id,
            origin: item.origin,
            destination: item.destination,
            departureDate: item.departureDate,
            initialPrice: item.initialPrice,
            currentPrice: item.currentPrice,
            status: 'expired',
            flightDetails: null
          };
        }

        const formattedFlight = await this.transformFlightData(rawFlight, item.searchId);

        return {
          _id: item._id,
          savedAt: (item as any).createdAt,
          initialPrice: item.initialPrice,
          currentPrice: item.currentPrice,
          status: item.status,
          ...formattedFlight
        };
      }),
    );
  }

  async remove(userId: string, id: string): Promise<any> {
    const result = await this.watchlistModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    
    if (result.deletedCount === 0) {
      throw new NotFoundException('Watchlist item not found');
    }
    return { message: 'Removed from watchlist' };
  }

  async transformFlightData(flight: any, searchId: string) {
    const itinerary = flight.itineraries[0];
    const segments = itinerary.segments;
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    const airlineCode = flight.validatingAirlineCodes[0];

    const airlineInfo = await this.airlinesService.getAirlineByIata(airlineCode);
    
    return {
      id: flight.id,
      search_id: searchId,
      airlineName: airlineInfo?.name || airlineCode,
      airlineLogo: airlineInfo?.logo || '',
      
      departure: {
        time: firstSegment.departure.at.split('T')[1].substring(0, 5),
        date: firstSegment.departure.at.split('T')[0],
        iataCode: firstSegment.departure.iataCode,
        terminal: firstSegment.departure.terminal,
      },
      arrival: {
        time: lastSegment.arrival.at.split('T')[1].substring(0, 5),
        date: lastSegment.arrival.at.split('T')[0],
        iataCode: lastSegment.arrival.iataCode,
        terminal: lastSegment.arrival.terminal,
      },

      duration: itinerary.duration
        .replace('PT', '')
        .replace('H', 'h ')
        .replace('M', 'm')
        .toLowerCase(),
      
      price: parseFloat(flight.price.total),
      currency: flight.price.currency,

      originCode: firstSegment.departure.iataCode,
      destinationCode: lastSegment.arrival.iataCode,

      segments: segments.map(s => ({
        departure: s.departure,
        arrival: s.arrival,
        carrierCode: s.carrierCode,
        flightNumber: s.number,
        aircraft: s.aircraft.code,
        duration: s.duration
      })),
      
      travelerPricings: flight.travelerPricings.map(tp => ({
        fareOption: tp.fareOption,
        travelerType: tp.travelerType,
        cabin: tp.fareDetailsBySegment[0].cabin, 
        amenities: tp.fareDetailsBySegment[0].amenities 
      })),

      stops: segments.length > 1 ? `${segments.length - 1} stop` : 'Direct',
    };
  }

  // async updatePrice(id: string, newPrice: number) {
  //   const item = await this.watchlistModel.findById(id);
  //   if (!item) return;

  //   if (newPrice < item.currentPrice) {
  //     item.status = 'price_dropped';
  //   } else if (newPrice > item.currentPrice) {
  //     item.status = 'price_increased';
  //   }

  //   item.currentPrice = newPrice;
  //   await item.save();
  // }
}