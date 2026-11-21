import { Schema, model } from 'mongoose';

const counterSchema = new Schema({ _id: { type: String }, seq: { type: Number, default: 0 } });
export const Counter = model('Counter', counterSchema);

// Atomic, per-key sequence (e.g. one invoice sequence per client)
export async function nextSeq(key: string): Promise<number> {
  const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return c.seq;
}