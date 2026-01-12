import { Injectable } from '@nestjs/common';

// This should be a real class/interface representing a user entity
export interface User {
  userId: number;
  username: string;
  password: string;
}

@Injectable()
export class UsersService {
  private readonly users = [
    {
      userId: 1,
      username: 'john',
      password: 'asdf',
    },
    {
      userId: 2,
      username: 'maria',
      password: 'asdfasdf',
    },
  ];

  async findOne(username: string): Promise<User | undefined> {
    return Promise.resolve(
      this.users.find((user) => user.username === username),
    );
  }
}
