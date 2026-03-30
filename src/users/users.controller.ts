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
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
// @UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List of user' })
  @ApiResponse({ status: 200, description: 'Sucessfully get the user information' })
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Get(':email')
  async getUserByEmail(@Param('email') email: string) {
    const user = await this.usersService.findOne(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, otpCode, otpExpires, ...safe } = (user as any).toObject();
    return safe;
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
    const { password, otpCode, otpExpires, ...safe } = (updatedUser as any).toObject();
    return safe;
  }

  @Get(':email/preferences')
  async getPreferences(@Param('email') email: string) {
    return this.usersService.getPreferences(email);
  }

  @Patch(':email/preferences')
  async updatePreferences(
    @Param('email') email: string,
    @Body() preferences: Record<string, any>,
  ) {
    const ALLOWED = ['homeAirport', 'budgetMax', 'flexibility', 'prefersDirect', 'preferredCabin'];
    const sanitized: Record<string, any> = {};
    for (const key of ALLOWED) {
      if (key in preferences) sanitized[key] = preferences[key];
    }
    return this.usersService.updatePreferences(email, sanitized);
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
