import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.gaurd';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * POST /bookings
   * Called by frontend after payment to create a booking.
   * Body: { searchId, flightId, travelers }
   */
  @Post()
  async create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.createBooking(createBookingDto);
  }

  /**
   * GET /bookings
   * Returns all bookings for the authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Request() req) {
    return this.bookingsService.getBookingsByUser(req.user.userId);
  }

  /**
   * GET /bookings/track?pnr=ABC123&lastName=SMITH
   * Public route — verifies PNR + last name, returns live booking from Amadeus.
   * Must be declared before /:id to avoid route collision.
   */
  @Get('track')
  async track(@Query('pnr') pnr: string, @Query('lastName') lastName: string) {
    return this.bookingsService.trackBooking(pnr, lastName);
  }

  /**
   * GET /bookings/:id
   * Returns a single booking by ID.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.bookingsService.getBookingById(id);
  }
}
