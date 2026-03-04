import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async signIn(email: string, pass: string): Promise<{ access_token: string }> {
    const user = await this.usersService.findOne(email);

    if (!user) {
      throw new UnauthorizedException("Email and Password do not match! Please try again later");
    }

    const isMatch = await bcrypt.compare(pass, user.password);

    if (!isMatch) {
      throw new UnauthorizedException("Email and Password do not match! Please try again later");
    }

    if (!user.isVerified) {
      throw new UnauthorizedException("Please verify your email before logging in");
    }
    const payload = { sub: user._id, email: user.email };
    
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async register(
    fname: string,
    lname: string,
    email: string,
    password: string,
    phoneNumber?: string,
  ): Promise<any> {

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    const user = await this.usersService.create({
      fname,
      lname,
      email,
      password,
      phoneNumber,
      otpCode: otp,
      otpExpires: otpExpires,
      isVerified: false
    });

    await this.mailService.sendOtpEmail(fname, email, otp, otpExpires);

    const userObj = user.toObject();
    delete userObj.password;
    return userObj;
  }

  async verifyEmail(email: string, otpCode: string) {
    const user = await this.usersService.findOne(email);

    if(!user || user.otpCode !== otpCode) {
      throw new UnauthorizedException("Invalid OTP");
    }
    if(new Date() > user.otpExpires!) {
      throw new UnauthorizedException("Expired OTP");
    }

    await this.usersService.verifyUser(email);
    return {
      message: "Successfully verification, you can login right now"
    };
  }

  async resendOtp(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findOne(email);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (user.isVerified) {
      throw new BadRequestException("This account already verified. Don't need to do it again");
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const newOtpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await this.usersService.updateOtp(email, newOtp, newOtpExpires);

    await this.mailService.sendOtpEmail(user.fname, email, newOtp, newOtpExpires);

    return { message: "A new code has been sent to your email." };
  }
}
