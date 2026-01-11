import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
<<<<<<< HEAD
  exports: [UsersService],
=======
  exports: [UsersService]
>>>>>>> 2427299 (users + auth)
})
export class UsersModule {}
