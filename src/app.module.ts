import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AirportsModule } from './airports/airports.module';
import { FlightsModule } from './flights/flights.module';
import { AirlinesModule } from './airlines/airlines.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:'.env'
    }),

    // Connect database in here
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
    }),


    AuthModule,
    UsersModule,
    AirportsModule,
    FlightsModule,
    AirlinesModule
    // WatchlistModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
