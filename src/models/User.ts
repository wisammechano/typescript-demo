import mongoose from 'mongoose';

export interface IUser {
  email?: string;
  name: string;
  firstname?: string;
  lastname?: string;
  created_at: Date;
  provider: string;
  providerId: string;
  profilePicture?: string;
}

const userSchema = new mongoose.Schema<IUser>({
  email: {
    type: String,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  firstname: {
    type: String,
  },
  lastname: {
    type: String,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  provider: {
    type: String,
  },
  providerId: {
    type: String,
    unique: true,
  },
  profilePicture: {
    type: String,
  },
});

export default mongoose.model<IUser>('User', userSchema);
