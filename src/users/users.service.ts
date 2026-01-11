import { Injectable } from '@nestjs/common';

<<<<<<< HEAD
// This should be a real class/interface representing a user entity
export interface User {
  userId: number;
  username: string;
  password: string;
}
=======

// This should be a real class/interface representing a user entity
export type User = any;
>>>>>>> 2427299 (users + auth)

@Injectable()
export class UsersService {
  private readonly users = [
    {
      userId: 1,
      username: 'john',
<<<<<<< HEAD
      password: 'asdf',
=======
      password: 'changeme',
>>>>>>> 2427299 (users + auth)
    },
    {
      userId: 2,
      username: 'maria',
<<<<<<< HEAD
      password: 'asdfasdf',
    },
  ];

  async findOne(username: string): Promise<User | undefined> {
    return Promise.resolve(
      this.users.find((user) => user.username === username),
    );
=======
      password: 'guess',
    },
  ];    

  async findOne(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
>>>>>>> 2427299 (users + auth)
  }
}
