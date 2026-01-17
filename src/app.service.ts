import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(@InjectConnection() private connection: Connection) {}

  onModuleInit() {
    if (this.connection.readyState === 1) {
      console.log('MongoDB status: CONNECTED (ReadyState: 1)');
    } else {
      console.log('MongoDB status: NOT CONNECTED');
    }
  }
}