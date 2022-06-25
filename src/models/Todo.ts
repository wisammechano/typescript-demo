import mongoose from 'mongoose';

export interface ITodo {
  text: string;
  done: boolean;
  createdAt: Date;
  user: mongoose.Types.ObjectId;
}

const todoSchema = new mongoose.Schema<ITodo>({
  text: {
    type: String,
    required: true,
  },
  done: {
    type: Boolean,
    required: true,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

const hider =
  (props: string[]) => (doc: ITodo, ret: Partial<ITodo>, options: any) => {
    props.forEach((prop: keyof ITodo) => {
      if (ret.hasOwnProperty(prop)) delete ret[prop];
    });
    return ret;
  };

todoSchema.set('toObject', { virtuals: true, transform: hider(['user']) });
todoSchema.set('toJSON', { virtuals: true, transform: hider(['user']) });

export default mongoose.model<ITodo>('Todo', todoSchema);
