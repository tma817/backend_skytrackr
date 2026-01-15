import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signIn(email: string, pass: string): Promise<{ access_token: string }> {
    const user = await this.usersService.findOne(email);
    if (user?.password !== pass) {
      throw new UnauthorizedException();
    }
    const payload = { sub: user.userId, email: user.email };
    console.log(payload);
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async register(
    fname: string,
    lname: string,
    email: string,
    password: string,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.usersService.create({
      fname,
      lname,
      email,
      password,
    });
    return {
      userId: user.userId,
      fname: user.fname,
      lname: user.lname,
      email: user.email,
      phoneNumber: user.phoneNumber,
    };
  }
}
