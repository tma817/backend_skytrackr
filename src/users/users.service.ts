import { Injectable } from '@nestjs/common';
// import { Watchlist } from '../watchlist/watchlist.interface';
// import { Passenger } from '../passenger/passenger.interface';
// import { FlightTicket } from '../flight-ticket/flight-ticket.interface';
// import { Payment } from '../payment/payment.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>
  ) {}

  async findOne(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }
  async hashPassword(password: string): Promise<string> {
    const saltOrRounds = 10;
    return await bcrypt.hash(password, saltOrRounds);
  }

  async create(userData: Partial<User>): Promise<any> {
    if (userData.password) {
      userData.password = await this.hashPassword(userData.password);
    }
    const newUser = new this.userModel(userData);
    return newUser.save();
  }


  async verifyUser(email: string): Promise<void> {
    await this.userModel.updateOne(
      { email },
      { 
        isVerified: true, 
        otpCode: null, 
        otpExpires: null 
      }
    ).exec();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }
}
