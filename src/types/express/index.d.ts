import { IUser } from '../../models/user';
import { ObjectId } from 'mongoose';
import unless from 'express-unless';

declare global {
  namespace Express {
    interface User extends Partial<IUser> {
      _id?: ObjectId;
    }

    interface Request {
      auth: {
        sub: string;
        name: string;
        email: string;
        providerId: string;
      };
    }
  }
}
