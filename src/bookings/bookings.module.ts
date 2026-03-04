import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { FlightsModule } from 'src/flights/flights.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([{ name: Booking.name, schema: BookingSchema }]),
    FlightsModule,
    MailModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
