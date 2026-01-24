// users.controller.ts
import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  NotFoundException,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';

@Controller('users')
// @UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Get(':email')
  async getUserByEmail(@Param('email') email: string) {
    const user = await this.usersService.findOne(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Patch(':email')
  async updateUser(
    @Param('email') email: string,
    @Body() updateData: Partial<User>,
  ) {
    delete updateData.otpCode;
    delete updateData.otpExpires;
    delete updateData.isVerified;

    const updatedUser = await this.usersService.updateUser(email, updateData);
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
    return updatedUser;
  }

  //   @UseGuards(JwtAuthGuard)
  //   @Get('profile')
  //   async getProfile(@Request() req) {
  //     const user = await this.usersService.findOne(req.user.email);
  //     if (!user) {
  //       throw new NotFoundException('User not found');
  //     }
  //     return user;
  //   }

  //   @UseGuards(JwtAuthGuard)
  //   @Patch('update-profile')
  //   async updateProfile(@Request() req, @Body() updateData: any) {
  //     delete updateData.password;
  //     delete updateData.email;
  //     return this.usersService.update(req.user.email, updateData);
  //   }
}
