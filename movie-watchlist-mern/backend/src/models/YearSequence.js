import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  _id: { type: Number, required: true },
  seq: { type: Number, default: 0, required: true }
}, { versionKey: false });
export default mongoose.model('YearSequence', schema);
