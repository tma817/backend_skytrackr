import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectModel } from '@nestjs/mongoose';
import { FlightSearch } from './schemas/flight.schema';
import { PriceGrid } from './schemas/price-grid.schema';
import { Model } from 'mongoose';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { AirlinesService } from 'src/airlines/airlines.service';
import { AirportsService } from 'src/airports/airports.service';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class FlightsService {
  private accessToken: string = '';
  private tokenExpiry: number = 0;
  private readonly anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(FlightSearch.name)
    private flightSearchModel: Model<FlightSearch>,
    @InjectModel(PriceGrid.name)
    private priceGridModel: Model<PriceGrid>,
    private airlineService: AirlinesService,
    private airportsService: AirportsService,
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

  async searchFlights(params: {
    origin: string;
    destination: string;
    departureDate: string;
    adults: number;
    returnDate?: string;
    children?: number;
    currencyCode?: string;
    travelClass?: string;
    max?: number;
    nonStop?: boolean;
    includedAirlineCodes?: string;
    excludedAirlineCodes?: string;
    maxPrice?: number;
    includedCheckedBagsOnly?: boolean;
    excludedAlliances?: string;
  }) {
    const {
      origin,
      destination,
      departureDate,
      adults,
      returnDate,
      children,
      currencyCode,
      travelClass,
      max = 50,
      nonStop,
      includedAirlineCodes,
      excludedAirlineCodes,
      maxPrice,
      includedCheckedBagsOnly,
      excludedAlliances,
    } = params;

    const today = new Date().toISOString().split('T')[0];

    if (departureDate < today) {
      throw new BadRequestException('Cannot search for flights in the past');
    }
    if (returnDate && returnDate < departureDate) {
      throw new BadRequestException('Return date must be after departure date');
    }

    const hasExtraParams = children !== undefined || currencyCode !== undefined ||
      travelClass !== undefined || max !== 50 || nonStop !== undefined ||
      includedAirlineCodes !== undefined || excludedAirlineCodes !== undefined ||
      maxPrice !== undefined || includedCheckedBagsOnly !== undefined ||
      excludedAlliances !== undefined;

    if (!hasExtraParams) {
      try {
        const cachedSearch = await this.flightSearchModel
          .findOne({ origin, destination, departureDate, returnDate, adults })
          .lean();

        if (cachedSearch && cachedSearch.results?.length > 0) {
          return cachedSearch;
        }
      } catch (error: any) {
        console.error('Error from read database:', error.message);
      }
    }

    const token = await this.getAccessToken();
    const url = 'https://test.api.amadeus.com/v2/shopping/flight-offers';

    try {
      const queryParams: Record<string, any> = {
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate,
        adults,
        currencyCode: currencyCode ?? 'CAD',
        max,
      };

      if (returnDate) queryParams.returnDate = returnDate;
      if (children !== undefined) queryParams.children = children;
      if (travelClass) queryParams.travelClass = travelClass;
      if (nonStop !== undefined) queryParams.nonStop = nonStop;
      if (includedAirlineCodes) queryParams.includedAirlineCodes = includedAirlineCodes;
      if (excludedAirlineCodes) queryParams.excludedAirlineCodes = excludedAirlineCodes;
      if (maxPrice !== undefined) queryParams.maxPrice = maxPrice;
      if (includedCheckedBagsOnly !== undefined) queryParams.includedCheckedBagsOnly = includedCheckedBagsOnly;
      if (excludedAlliances) queryParams.excludedAlliances = excludedAlliances;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          params: queryParams,
        }),
      );
      const flights = response.data.data;
      const newFlight = await this.flightSearchModel.create({
        origin,
        destination,
        departureDate,
        returnDate,
        adults,
        results: flights,
      });
      return newFlight.toObject();
    } catch (error: any) {
      const status = error.response?.status;
      const amadeusError = error.response?.data?.errors?.[0];
      console.error(`Amadeus API Error [${status}]:`, amadeusError || error.response?.data || error.message);

      if (status === 429) {
        throw new BadRequestException('Amadeus rate limit reached — please wait a moment and try again');
      }
      if (status === 400) {
        throw new BadRequestException(amadeusError?.detail || 'Invalid flight search parameters');
      }

      throw new Error('Could not fetch flights from Amadeus');
    }
  }

  async processFlightResults(rawSearch: any, query: SearchFlightsDto)
  {
    const {
      page = 1,
      limit = 5,
      maxPrice,
      stops,
      airline,
      cabin,
      timeFrom,
      timeTo,
    } = query;

    let results = rawSearch.results || [];

    // --- 1. APPLY FILTERS ---
    const filteredFlights = results.filter((flight) => {
      if (!flight?.itineraries?.[0]?.segments?.length) return false;

      // Max price
      if (maxPrice != null && parseFloat(flight.price.total) > Number(maxPrice)) return false;

      // Stops
      if (stops !== undefined && stops !== null) {
        const flightStops = flight.itineraries[0].segments.length - 1;
        if (flightStops !== Number(stops)) return false;
      }

      // Airline
      if (airline && !flight.validatingAirlineCodes.includes(airline.toUpperCase())) return false;

      // Cabin
      if (cabin) {
        const hasMatchingCabin = flight.travelerPricings?.some(
          (tp: any) =>
            tp.fareDetailsBySegment?.[0]?.cabin?.toUpperCase() === cabin.toUpperCase(),
        );
        if (!hasMatchingCabin) return false;
      }

      // Time range
      if (timeFrom || timeTo) {
        const departureAt = flight.itineraries[0].segments[0].departure?.at;
        const timeString = departureAt?.split('T')[1]?.substring(0, 5);
        if (!timeString) return false;
        if (timeFrom && timeString < timeFrom) return false;
        if (timeTo && timeString > timeTo) return false;
      }

      return true;
    });

    const seenFlights = new Set<string>();
    const noDupedFlights = filteredFlights.filter((flight) => {

    const firstSeg = flight.itineraries[0]?.segments[0];
    const lastSeg = flight.itineraries[0]?.segments[flight.itineraries[0].segments.length - 1];
    const returnFirstSeg = flight.itineraries[1]?.segments[0];
    const returnLastSeg = flight.itineraries[1]?.segments[flight.itineraries[1]?.segments.length - 1];

    const key = [
        flight.validatingAirlineCodes[0],
        firstSeg?.departure?.iataCode,
        firstSeg?.departure?.at?.substring(0, 16),
        lastSeg?.arrival?.at?.substring(0, 16),
        returnFirstSeg?.departure?.at?.substring(0, 16),
        returnLastSeg?.arrival?.at?.substring(0, 16),
        Math.round(parseFloat(flight.price.total)),
    ].join('-');

      if (seenFlights.has(key)) return false;
      seenFlights.add(key);
      return true;
    });

      // --- 2. PAGINATION ---
    const total = noDupedFlights.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const pageItems = noDupedFlights.slice(start, end);

    // --- 3. MAPPING & FORMATTING ---
    const items = await Promise.all(
      pageItems.map(async (flight) => {
        const airlineCode = flight.validatingAirlineCodes[0];
        const airlineInfo = await this.airlineService.getAirlineByIata(airlineCode);

        return {
          id: flight.id,
          search_id: rawSearch._id,
          airline: {
            name: airlineInfo?.name || airlineCode,
            logo: airlineInfo?.logo || '',
          },
          price: {
            amount: parseFloat(flight.price.total),
            currency: flight.price.currency,
          },
          pricePerPerson: parseFloat(flight.travelerPricings?.[0]?.price?.total ?? flight.price.total),
          numberOfBookableSeats: flight.numberOfBookableSeats ?? null,
          lastTicketingDate: flight.lastTicketingDate ?? null,
          refundable: flight.pricingOptions?.refundableFare ?? false,
          itineraries: await Promise.all(flight.itineraries.map(async (it, index) => ({
            type: index === 0 ? 'outbound' : 'inbound',
            duration: this.formatDuration(it.duration),
            stops: it.segments.length - 1,
            departure: await this.formatEndPoint(it.segments[0].departure),
            arrival: await this.formatEndPoint(it.segments[it.segments.length - 1].arrival),
            segments: it.segments.map((s, sIdx) => {
              const segmentData: any = this.mapSegment(s);
              if (sIdx < it.segments.length - 1) {
                segmentData.layover = this.calculateLayover(
                  s.arrival.at,
                  it.segments[sIdx + 1].departure.at
                );
              }
              return segmentData;
            }),
          }))),
          cabin: flight.travelerPricings?.[0]?.fareDetailsBySegment[0]?.cabin,
          baggage: {
            checked: flight.travelerPricings?.[0]?.fareDetailsBySegment[0]?.includedCheckedBags?.quantity || 0,
          },
        };
      }),
    );

    return {
      items,
      page,
      limit,
      total,
      hasMore: end < total,
    };
  }

  async confirmPrice(searchId: string, flightId: string) {
    const flightSearch = await this.flightSearchModel.findById(searchId).lean();
    if (!flightSearch) {
      throw new NotFoundException('Search session expired');
    }

    const cachedFlight = flightSearch.results.find((f: any) => String(f.id) === String(flightId));
    if (!cachedFlight) {
      throw new NotFoundException('Flight not found');
    }

    const token = await this.getAccessToken();

    // Re-fetch a fresh offer from Amadeus to avoid "No fare applicable" on stale cached offers
    let offerToPrice = cachedFlight;
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
            currencyCode: cachedFlight.price?.currency ?? 'CAD',
            max: 50,
          },
        }),
      );

      const freshOffers: any[] = searchRes.data.data ?? [];

      // Find the closest matching offer: same airline, same departure time on first segment
      const cachedDep = cachedFlight.itineraries?.[0]?.segments?.[0]?.departure;
      const matched = freshOffers.find((o: any) => {
        const dep = o.itineraries?.[0]?.segments?.[0]?.departure;
        return (
          o.validatingAirlineCodes?.[0] === cachedFlight.validatingAirlineCodes?.[0] &&
          dep?.iataCode === cachedDep?.iataCode &&
          dep?.at?.substring(0, 16) === cachedDep?.at?.substring(0, 16)
        );
      });

      if (matched) offerToPrice = matched;
    } catch (refreshErr: any) {
      console.warn('Could not refresh flight offer, using cached:', refreshErr.message);
    }

    const pricingUrl = 'https://test.api.amadeus.com/v1/shopping/flight-offers/pricing';

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          pricingUrl,
          { data: { type: 'flight-offers-pricing', flightOffers: [offerToPrice] } },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const confirmed = response.data.data.flightOffers[0];
      const grandTotal = parseFloat(confirmed.price.grandTotal);
      const base = parseFloat(confirmed.price.base);

      return {
        id: confirmed.id,
        confirmed: true,
        price: {
          grandTotal,
          base,
          taxTotal: parseFloat((grandTotal - base).toFixed(2)),
          currency: confirmed.price.currency,
          taxes: (confirmed.price.taxes ?? []).map((t: any) => ({
            code: t.code,
            amount: parseFloat(t.amount),
          })),
          fees: (confirmed.price.fees ?? []).map((f: any) => ({
            type: f.type,
            amount: parseFloat(f.amount),
          })),
        },
        itineraries: await Promise.all(confirmed.itineraries.map(async (it: any, index: number) => ({
          type: index === 0 ? 'outbound' : 'inbound',
          duration: it.duration ? this.formatDuration(it.duration) : '',
          segments: await Promise.all(it.segments.map(async (s: any) => ({
            departure: await this.formatEndPoint(s.departure),
            arrival: await this.formatEndPoint(s.arrival),
            carrierCode: s.carrierCode,
            flightNumber: s.number,
            aircraft: s.aircraft?.code ?? '',
            duration: s.duration ? this.formatDuration(s.duration) : '',
          }))),
        }))),
        travelerPricings: (confirmed.travelerPricings ?? []).map((tp: any) => ({
          travelerId: tp.travelerId,
          fareOption: tp.fareOption,
          travelerType: tp.travelerType,
          price: {
            base: parseFloat(tp.price.base ?? '0'),
            total: parseFloat(tp.price.total),
            currency: tp.price.currency,
          },
          cabin: tp.fareDetailsBySegment?.[0]?.cabin,
          fareBasis: tp.fareDetailsBySegment?.[0]?.fareBasis,
          includedCheckedBags: tp.fareDetailsBySegment?.[0]?.includedCheckedBags ?? null,
        })),
      };
    } catch (error: any) {
      console.error('Pricing API Error:', error.response?.data || error.message);

      // Graceful fallback: return cached price with confirmed: false
      const cachedTotal = parseFloat(cachedFlight.price?.grandTotal ?? cachedFlight.price?.total ?? '0');
      const cachedBase = parseFloat(cachedFlight.price?.base ?? '0');
      return {
        id: cachedFlight.id,
        confirmed: false,
        price: {
          grandTotal: cachedTotal,
          base: cachedBase,
          taxTotal: parseFloat((cachedTotal - cachedBase).toFixed(2)),
          currency: cachedFlight.price?.currency ?? 'CAD',
          taxes: [],
          fees: (cachedFlight.price?.fees ?? []).map((f: any) => ({
            type: f.type,
            amount: parseFloat(f.amount),
          })),
        },
        itineraries: [],
        travelerPricings: [],
      };
    }
  }

  //SEAT MAP HERE
  async getSeatMap(searchId: string, flightId: string) {
    const flightSearch = await this.flightSearchModel.findById(searchId).lean();
    if (!flightSearch) {
      throw new NotFoundException('Search session expired');
    }

    const rawFlight = flightSearch.results.find((f: any) => String(f.id) === String(flightId));
    if (!rawFlight) {
      throw new NotFoundException('Flight not found');
    }

    // Strip ALL Mongoose _id/__v fields recursively and sanitize mandatory fields
    const deepClean = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(deepClean);
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
          if (key === '_id' || key === '__v') continue;
          result[key] = deepClean(obj[key]);
        }
        return result;
      }
      return obj;
    };

    const sanitizeFlight = (f: any) => {
      const cleaned = deepClean(JSON.parse(JSON.stringify(f)));

      // fareBasis is mandatory for seatmaps — default to empty string if missing
      if (Array.isArray(cleaned.travelerPricings)) {
        cleaned.travelerPricings = cleaned.travelerPricings.map((tp: any) => {
          if (Array.isArray(tp.fareDetailsBySegment)) {
            tp.fareDetailsBySegment = tp.fareDetailsBySegment.map((fd: any) => {
              if (!fd.fareBasis) fd.fareBasis = '';
              return fd;
            });
          }
          return tp;
        });
      }

      return cleaned;
    };

    const flightOffer = sanitizeFlight(rawFlight);
    const { travelerPricings, itineraries, ...topLevel } = flightOffer;
    console.log('SeatMap top-level fields:', JSON.stringify(topLevel, null, 2));
    console.log('SeatMap itinerary segment[0]:', JSON.stringify(itineraries?.[0]?.segments?.[0], null, 2));
    console.log('SeatMap fareDetails[0]:', JSON.stringify(travelerPricings?.[0]?.fareDetailsBySegment?.[0], null, 2));

    const token = await this.getAccessToken();
    const url = 'https://test.api.amadeus.com/v1/shopping/seatmaps';

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { data: [flightOffer] },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data.data;
    } catch (error: any) {
      console.error('SeatMap API Error:', JSON.stringify(error.response?.data, null, 2) || error.message);
      throw new BadRequestException(
        error.response?.data?.errors?.[0]?.detail || 'Could not fetch seat map',
      );
    }
  }

  async getFlightDetail(searchId: string, flightId: string) {
    const flightSearch = await this.flightSearchModel.findById(searchId).lean();

    if (!flightSearch) {
      throw new NotFoundException('Flights are not available, please try again later!!!');
    }
    const rawFlight = flightSearch.results.find((f: any) => f.id === flightId);

    if (!rawFlight) {
      throw new NotFoundException('Flight can not be found!');
    }

    const airlineCode = rawFlight.validatingAirlineCodes[0];
    const airlineInfo = await this.airlineService.getAirlineByIata(airlineCode);

    return {
      id: rawFlight.id,
      search_id: flightSearch._id,
      airline: {
        name: airlineInfo?.name || airlineCode,
        logo: airlineInfo?.logo || '',
      },
      price: {
        amount: parseFloat(rawFlight.price.total),
        currency: rawFlight.price.currency,
      },
      itineraries: await Promise.all(rawFlight.itineraries.map(async (it, index) => ({
        type: index === 0 ? 'outbound' : 'inbound',
        duration: this.formatDuration(it.duration),
        stops: it.segments.length - 1,
        departure: await this.formatEndPoint(it.segments[0].departure),
        arrival: await this.formatEndPoint(it.segments[it.segments.length - 1].arrival),
        segments: await Promise.all(it.segments.map(async (s, sIdx) => {
          const segmentData: any = {
            departure: await this.formatEndPoint(s.departure),
            arrival: await this.formatEndPoint(s.arrival),
            carrierCode: s.carrierCode,
            flightNumber: s.number,
            aircraft: s.aircraft.code,
            duration: this.formatDuration(s.duration),
          };

          if (sIdx < it.segments.length - 1) {
            segmentData.layover = this.calculateLayover(
              s.arrival.at,
              it.segments[sIdx + 1].departure.at,
            );
          }
          return segmentData;
        })),
      }))),
      cabin: rawFlight.travelerPricings?.[0]?.fareDetailsBySegment[0]?.cabin,
      baggage: {
        checked: rawFlight.travelerPricings?.[0]?.fareDetailsBySegment[0]?.includedCheckedBags?.quantity || 0,
      },
    };
  }



  // ─── PRICE GRID ────────────────────────────────────────────────────────────

  /**
   * Returns cheapest price per day for a 7-day window centred on departureDate.
   *
   * Strategy (avoids rate limits):
   *  - Cache is stored per (origin, destination, yearMonth, currency) in MongoDB
   *    with a 6-hour TTL index.
   *  - On a cache hit for ALL requested dates → return immediately.
   *  - On a miss → fetch only the missing dates one-at-a-time from
   *    GET /v2/shopping/flight-offers?max=1, with a 350 ms pause between each
   *    call (~2 req/s, well under Amadeus test limits).
   */
  async getPriceGrid(params: {
    origin: string;
    destination: string;
    departureDate: string;
    currency?: string;
    oneWay?: boolean;
    returnDate?: string;
  }) {
    const { origin, destination, departureDate, currency = 'CAD', oneWay = true, returnDate } = params;

    const [year, month] = departureDate.split('-');
    const yearMonth = `${year}-${month}`;

    // Build the 7-date window centred on the requested date
    const windowDates = this.buildDateWindow(departureDate, 7);

    // 1. Load whatever we already have cached for this month
    const cached = await this.priceGridModel
      .findOne({ origin, destination, yearMonth, currency, oneWay })
      .lean();

    const priceMap = new Map<string, number>(
      (cached?.data ?? []).map((d) => [d.date, d.price]),
    );

    // 2. Determine which window dates are missing from cache
    const missing = windowDates.filter((d) => !priceMap.has(d));

    if (missing.length > 0) {
      const token = await this.getAccessToken();

      // For roundtrip: compute trip duration in days to keep it consistent per nearby date
      const tripDurationDays =
        !oneWay && returnDate
          ? Math.round(
              (new Date(returnDate + 'T00:00:00').getTime() -
                new Date(departureDate + 'T00:00:00').getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 0;

      for (let i = 0; i < missing.length; i++) {
        const date = missing[i];

        // For roundtrip, shift the return date by the same offset as the departure date
        const nearbyReturnDate =
          !oneWay && tripDurationDays > 0
            ? new Date(new Date(date + 'T00:00:00').getTime() + tripDurationDays * 86400000)
                .toISOString()
                .slice(0, 10)
            : undefined;

        try {
          const res = await firstValueFrom(
            this.httpService.get(
              'https://test.api.amadeus.com/v2/shopping/flight-offers',
              {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                  originLocationCode: origin,
                  destinationLocationCode: destination,
                  departureDate: date,
                  adults: 1,
                  max: 1,
                  currencyCode: currency,
                  ...(nearbyReturnDate ? { returnDate: nearbyReturnDate } : {}),
                },
              },
            ),
          );
          const cheapest = res.data.data?.[0];
          const price = parseFloat(cheapest?.price?.total ?? '0');
          if (price > 0) priceMap.set(date, price);
        } catch {
          // No flights on this date — leave it absent from the map
        }

        // Throttle: pause between requests (skip after last one)
        if (i < missing.length - 1) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }

      // 3. Upsert merged data back to cache
      const allData = Array.from(priceMap.entries())
        .map(([date, price]) => ({ date, price }))
        .sort((a, b) => a.date.localeCompare(b.date));

      await this.priceGridModel.findOneAndUpdate(
        { origin, destination, yearMonth, currency, oneWay },
        { data: allData, cachedAt: new Date() },
        { upsert: true, new: true },
      );
    }

    // 4. Return only window dates that have a price
    const data = windowDates
      .filter((d) => priceMap.has(d))
      .map((d) => ({ date: d, price: priceMap.get(d)! }));

    return {
      yearMonth,
      origin,
      destination,
      currency,
      oneWay,
      data,
      cached: missing.length === 0,
    };
  }

  // ─── PRICE ANALYSIS ────────────────────────────────────────────────────────

  async getPriceAnalysis(params: {
    origin: string;
    destination: string;
    departureDate: string;
    currentPrice: number;
    currency?: string;
    oneWay?: boolean;
    returnDate?: string;
  }) {
    const { origin, destination, departureDate, currentPrice, currency = 'CAD', oneWay = true, returnDate } = params;

    const today = new Date();
    const dep = new Date(departureDate + 'T00:00:00');
    const daysUntil = Math.ceil((dep.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Fetch price grid (uses cache if available, otherwise fetches from Amadeus)
    let priceMetrics: { minimum: number; median: number; maximum: number } | null = null;
    let percentile: number | null = null;

    try {
      const gridResult = await this.getPriceGrid({ origin, destination, departureDate, currency, oneWay, returnDate });
      const prices = gridResult.data
        .map((d) => d.price)
        .filter((p) => p > 0)
        .sort((a, b) => a - b);

      if (prices.length >= 2) {
        const minimum = prices[0];
        const maximum = prices[prices.length - 1];
        const mid = Math.floor(prices.length / 2);
        const median =
          prices.length % 2 === 0
            ? (prices[mid - 1] + prices[mid]) / 2
            : prices[mid];

        priceMetrics = { minimum, median, maximum };

        if (maximum >= minimum) {
          percentile = Math.round(((currentPrice - minimum) / (maximum - minimum)) * 100);
          percentile = Math.max(0, Math.min(100, percentile));
        }
      }
    } catch {
      // Grid fetch failed — proceed with timing-only verdict
    }

    console.log(`[PriceAnalysis] priceMetrics=${JSON.stringify(priceMetrics)} percentile=${percentile}`);

    // ── AI verdict when price grid data is available ──────────────────────────
    if (priceMetrics && percentile !== null && daysUntil > 0) {
      try {
        const prompt = `You are a flight price analyst. Give a clear buy/wait recommendation based on the data below.
          ROUTE: ${origin} → ${destination}
          DEPARTURE: ${departureDate} (${daysUntil} days from today)
          CURRENT PRICE: ${currentPrice} ${currency}

          NEARBY DATES PRICE RANGE (cheapest available flight per day, same route):
          - Lowest nearby price:  ${priceMetrics.minimum} ${currency}
          - Median nearby price:  ${priceMetrics.median} ${currency}
          - Highest nearby price: ${priceMetrics.maximum} ${currency}
          - This price is at the ${percentile}th percentile (0 = cheapest, 100 = most expensive)

          Rules to consider:
          - Airline prices almost always rise within 3 weeks of departure.
          - A price below the median is generally a good deal.
          - If the price is above the 70th percentile AND departure is more than 2 weeks away, waiting may help.
          - If departure is within 7 days, always recommend buying now.

          Respond ONLY with a valid JSON object, no other text:
          {
            "verdict": "buy_now" | "wait" | "uncertain",
            "verdictReason": "<1-2 sentence plain English explanation for a traveller>"
          }`;

        console.log(`[PriceAnalysis] Calling Claude for ${origin}→${destination} | price=${currentPrice} ${currency} | percentile=${percentile} | daysUntil=${daysUntil}`);

        const response = await this.anthropic.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        });

        const textBlock = response.content.find((b) => b.type === 'text');
        const raw = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
        console.log(`[PriceAnalysis] Claude raw response: ${raw}`);

        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.verdict && parsed.verdictReason) {
            console.log(`[PriceAnalysis] Claude verdict: ${parsed.verdict} — ${parsed.verdictReason}`);
            return {
              origin, destination, departureDate, currency, currentPrice, daysUntil, percentile,
              priceMetrics,
              verdict: parsed.verdict,
              verdictReason: parsed.verdictReason,
            };
          }
        }
        console.warn('[PriceAnalysis] Could not parse Claude response, falling back to rules');
      } catch (err: any) {
        console.error(`[PriceAnalysis] Claude call failed: ${err.message} — falling back to rules`);
      }
    }

    // ── Rule-based fallback (no price grid data or AI failed) ─────────────────
    let verdict: 'buy_now' | 'wait' | 'uncertain';
    let verdictReason: string;

    if (daysUntil <= 0) {
      verdict = 'buy_now';
      verdictReason = 'Departure is today or has passed.';
    } else if (daysUntil <= 7) {
      verdict = 'buy_now';
      verdictReason = 'Departure is within a week — prices rarely drop this close to the date.';
    } else if (daysUntil <= 21) {
      verdict = 'buy_now';
      verdictReason = 'Under 3 weeks to departure — flight prices typically increase in this window.';
    } else if (daysUntil <= 45) {
      verdict = 'buy_now';
      verdictReason = 'Within 6 weeks of departure prices usually start climbing. Booking now is generally advisable.';
    } else {
      verdict = 'wait';
      verdictReason = 'Departure is still far out. Prices may drop — consider checking back in a few weeks.';
    }

    return {
      origin, destination, departureDate, currency, currentPrice, daysUntil, percentile,
      priceMetrics,
      verdict, verdictReason,
    };
  }

  private buildDateWindow(center: string, days: number): string[] {
    const result: string[] = [];
    const half = Math.floor(days / 2);
    const base = new Date(center + 'T00:00:00');
    for (let i = -half; i <= half; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      result.push(d.toISOString().split('T')[0]);
    }
    return result;
  }

  //SUPPORT FUNCTION GO HERE

  private formatDuration(d: string) {
    return d.replace('PT', '').replace('H', 'h ').replace('M', 'm').toLowerCase();
  }

  private async formatEndPoint(ep: any) {
    const airport = await this.airportsService.getByIata(ep.iataCode).catch(() => null);
    return {
      time: ep.at.split('T')[1].substring(0, 5),
      date: ep.at.split('T')[0],
      iataCode: ep.iataCode,
      terminal: ep.terminal,
      cityName: airport?.city ?? null,
      airportName: airport?.name ?? null,
    };
  }

  private mapSegment(s: any) {
    return {
      departure: s.departure,
      arrival: s.arrival,
      carrierCode: s.carrierCode,
      flightNumber: s.number,
      aircraft: s.aircraft.code,
      duration: s.duration,
    };
  }
  private calculateLayover(arrivalAt: string, nextDepartureAt: string): string {
    const arrival = new Date(arrivalAt);
    const departure = new Date(nextDepartureAt);

    const diffMs = departure.getTime() - arrival.getTime();

    if (diffMs <= 0) return '';

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m`;

    return result.trim();
  }
}
