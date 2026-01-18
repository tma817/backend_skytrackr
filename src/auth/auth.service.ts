import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';

import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private resend: Resend;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
  }

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

    try {
      await this.resend.emails.send({
        from: 'SkyTrackr <otp@kaknguyen.info>',
        to: email,
        subject: 'Verification for SkyTrackr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
            <h2 style="color: #2563eb;">Hi ${fname}!</h2>
            <p>Thank you for joining SkyTrackr. Your verification code is:</p>
            <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
              ${otp}
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              This code will expire in 10 minutes (at ${otpExpires.toLocaleTimeString()}).
            </p>
          </div>
        `,
      });
    } catch (error) {
      console.error(error);
    }
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
}
