import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
<<<<<<< HEAD

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async signIn(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(username);
    if (user?.password !== pass) {
      throw new UnauthorizedException();
    }
    const { password, ...result } = user;
    // TODO: Generate a JWT and return it here
    // instead of the user object
    return result;
  }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(username);
    if (user && user.password === pass) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async register(username: string, pass: string): Promise<any> {
    const existingUser = await this.usersService.findOne(username);
    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }
    // In a real application, you would hash the password
    const newUser = { id: Date.now(), username, password: pass };
    // Here you would save the new user to the database
    // For this example, we'll just return the new user without the password
    const { password, ...result } = newUser;
    return result;
  }
=======
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService
    ) {}
    
    async signIn(username: string, pass: string,): Promise<{ access_token: string }> 
    {
        const user = await this.usersService.findOne(username);
        if (user?.password !== pass) {
            throw new UnauthorizedException();
        }
        const payload = { sub: user.userId, username: user.username };
        console.log(payload)
        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }
>>>>>>> 2427299 (users + auth)
}
