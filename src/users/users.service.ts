import { Injectable } from '@nestjs/common';
// import { Watchlist } from '../watchlist/watchlist.interface';
// import { Passenger } from '../passenger/passenger.interface';
// import { FlightTicket } from '../flight-ticket/flight-ticket.interface';
// import { Payment } from '../payment/payment.interface';

// This should be a real class/interface representing a user entity
export interface User {
  userId: number;
  fname: string;
  lname: string;
  email: string;
  password: string;
  phoneNumber?: string;

  // watchlistSet?: Watchlist[];
  // passengerSet?: Passenger[];
  // flightTicketSet?: FlightTicket[];
  // payment?: Payment;
}

@Injectable()
export class UsersService {
  private readonly users: User[] = [
    {
      userId: 1,
      fname: 'john',
      lname: 'smith',
      email: 'johnsmith1@gmail.com',
      password: 'asdf',
      phoneNumber: '1234567890',
    },
    {
      userId: 2,
      fname: 'maria',
      lname: 'garcia',
      email: 'mariagar22@gmail.com',
      password: 'asdfasdf',
      phoneNumber: '0987654321',
    },
  ];

  private nextId = 3;

  findOne(email: string): Promise<User | undefined> {
    return Promise.resolve(this.users.find((user) => user.email === email));
  }

  async create(user: Omit<User, 'userId'>): Promise<User> {
    const existing = await this.findOne(user.email);
    if (existing) {
      throw new Error('User already exists');
    }

    const newUser: User = {
      userId: this.nextId++,
      ...user,
    };

    this.users.push(newUser);
    return newUser;
  }
}
