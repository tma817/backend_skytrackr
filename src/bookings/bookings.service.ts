import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { Booking } from './schemas/booking.schema';
import { FlightSearch } from 'src/flights/schemas/flight.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class BookingsService {
  private accessToken: string = '';
  private tokenExpiry: number = 0;

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(FlightSearch.name) private flightSearchModel: Model<FlightSearch>,
    private readonly mailService: MailService,
  ) {}

  private async getAccessToken() {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry) return this.accessToken;

    const url = 'https://test.api.amadeus.com/v1/security/oauth2/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.AMADEUS_CLIENT_ID ?? '');
    params.append('client_secret', process.env.AMADEUS_CLIENT_SECRET ?? '');

    const response = await firstValueFrom(
      this.httpService.post(url, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = now + response.data.expires_in * 1000;
    return this.accessToken;
  }

  async createBooking(dto: CreateBookingDto) {
    const { searchId, flightId, travelers, seatings, remarks, ticketingAgreement } = dto;

    // 1. Retrieve the raw flight offer from the cached search
    const flightSearch = await this.flightSearchModel.findById(searchId).lean();
    if (!flightSearch) {
      throw new NotFoundException('Flight search session not found or expired');
    }

    const rawFlight = flightSearch.results.find(
      (f: any) => String(f.id) === String(flightId),
    );
    if (!rawFlight) {
      throw new NotFoundException('Flight offer not found');
    }

    const token = await this.getAccessToken();

    // 2. Re-fetch a fresh matching offer from Amadeus
    let offerToBook = rawFlight;
    try {
      const searchRes = await firstValueFrom(
        this.httpService.get('https://test.api.amadeus.com/v2/shopping/flight-offers', {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            originLocationCode: flightSearch.origin,
            destinationLocationCode: flightSearch.destination,
            departureDate: flightSearch.departureDate,
            adults: flightSearch.adults,
            ...(flightSearch.returnDate ? { returnDate: flightSearch.returnDate } : {}),
            currencyCode: rawFlight.price?.currency ?? 'CAD',
            max: 50,
          },
        }),
      );

      const freshOffers: any[] = searchRes.data.data ?? [];
      const cachedDep = rawFlight.itineraries?.[0]?.segments?.[0]?.departure;
      const matched = freshOffers.find((o: any) => {
        const dep = o.itineraries?.[0]?.segments?.[0]?.departure;
        return (
          o.validatingAirlineCodes?.[0] === rawFlight.validatingAirlineCodes?.[0] &&
          dep?.iataCode === cachedDep?.iataCode &&
          dep?.at?.substring(0, 16) === cachedDep?.at?.substring(0, 16)
        );
      });

      if (matched) offerToBook = matched;
    } catch (refreshErr: any) {
      console.warn('Could not refresh offer, using cached:', refreshErr.message);
    }

    // 3. Price the offer to get a confirmed bookable offer
    try {
      const priceRes = await firstValueFrom(
        this.httpService.post(
          'https://test.api.amadeus.com/v1/shopping/flight-offers/pricing',
          { data: { type: 'flight-offers-pricing', flightOffers: [offerToBook] } },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
        ),
      );
      offerToBook = priceRes.data.data.flightOffers[0];
    } catch (priceErr: any) {
      console.warn('Could not re-price offer, using unpriced offer:', priceErr.message);
    }

    // 4. Call Amadeus Flight Orders API
    const url = 'https://test.api.amadeus.com/v1/booking/flight-orders';

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            data: {
              type: 'flight-order',
              flightOffers: [offerToBook],
              travelers,
              ...(seatings && seatings.length > 0 && { seatings }),
              ...(remarks && { remarks }),
              ...(ticketingAgreement && { ticketingAgreement }),
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const order = response.data.data;

      // Extract PNR from associatedRecords (first GDS record)
      const pnr: string = order.associatedRecords?.[0]?.reference ?? '';

      // 3. Save booking to MongoDB
      const booking = await this.bookingModel.create({
        amadeusOrderId: order.id,
        pnr,
        flightOffer: offerToBook,
        travelers,
        seatings: seatings ?? [],
        totalPrice: rawFlight.price.total,
        currency: rawFlight.price.currency,
        status: 'CONFIRMED',
      });

      const result = {
        bookingId: String(booking._id),
        amadeusOrderId: order.id,
        pnr,
        status: 'CONFIRMED',
        totalPrice: rawFlight.price.total,
        currency: rawFlight.price.currency,
        travelers: order.travelers,
        flightOffers: order.flightOffers,
        seatings: seatings ?? [],
      };

      // 4. Send confirmation email (non-blocking)
      this.mailService.sendBookingConfirmation(result).catch(() => {});

      return result;
    } catch (error: any) {
      console.error('Amadeus Booking Error:', error.response?.data || error.message);
      throw new BadRequestException(
        error.response?.data?.errors?.[0]?.detail || 'Could not create booking',
      );
    }
  }

  async trackBooking(pnr: string, lastName: string) {
    const booking = await this.bookingModel.findOne({
      pnr: pnr.trim().toUpperCase(),
    }).lean();

    if (!booking) {
      throw new NotFoundException('No booking found with that PNR');
    }

    // Verify last name matches any traveler on the booking
    const lastNameUpper = lastName.trim().toUpperCase();
    const matched = (booking.travelers as any[]).some(
      (t) => (t.name?.lastName ?? t.lastName ?? '').toUpperCase() === lastNameUpper,
    );
    if (!matched) {
      throw new NotFoundException('No booking found with that PNR and last name');
    }

    // Try to fetch live data from Amadeus; fall back to stored data if order was purged
    let order: any = null;
    try {
      const token = await this.getAccessToken();
      const url = `https://test.api.amadeus.com/v1/booking/flight-orders/${booking.amadeusOrderId}`;
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      order = response.data.data;
    } catch (error: any) {
      // Order purged from Amadeus (test env) or network error — use stored data
      console.warn('Amadeus order not found, falling back to stored data:', error.response?.data?.errors?.[0]?.detail || error.message);
    }

    const flightOffer = order?.flightOffers?.[0] ?? (booking as any).flightOffer;
    const storedTravelers = (booking as any).travelers ?? [];

    return {
      bookingId: booking._id,
      amadeusOrderId: booking.amadeusOrderId,
      pnr: booking.pnr,
      status: booking.status,
      createdAt: (booking as any).createdAt,
      source: order ? 'amadeus' : 'local',
      price: {
        amount: flightOffer?.price?.grandTotal ?? booking.totalPrice,
        currency: flightOffer?.price?.currency ?? booking.currency,
      },
      travelers: (order?.travelers ?? storedTravelers).map((t: any) => ({
        id: t.id,
        name: t.name ? `${t.name.firstName} ${t.name.lastName}` : `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim(),
        dateOfBirth: t.dateOfBirth,
        contact: t.contact,
        documents: t.documents,
      })),
      itineraries: flightOffer?.itineraries?.map((it: any, index: number) => ({
        type: index === 0 ? 'outbound' : 'inbound',
        duration: it.duration,
        segments: it.segments.map((s: any) => ({
          departure: {
            iataCode: s.departure.iataCode,
            terminal: s.departure.terminal,
            time: s.departure.at,
          },
          arrival: {
            iataCode: s.arrival.iataCode,
            terminal: s.arrival.terminal,
            time: s.arrival.at,
          },
          carrierCode: s.carrierCode,
          flightNumber: s.number,
          aircraft: s.aircraft?.code,
          duration: s.duration,
        })),
      })),
      seatings: booking.seatings,
      remarks: order?.remarks,
      ticketingAgreement: order?.ticketingAgreement,
      contacts: order?.contacts,
    };
  }

  async getBookingsByUser(userId: string) {
    return this.bookingModel
      .find({ userId })
      .select('-flightOffer')  // exclude raw offer to keep response lean
      .sort({ createdAt: -1 })
      .lean();
  }

  async getBookingById(bookingId: string) {
    const booking = await this.bookingModel.findById(bookingId).lean();
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }
}
