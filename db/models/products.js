import mongoose from "mongoose"
const { Schema } = mongoose

/*
  1 - instock
  2 - preorder
  3 - out of stock
  4 - out of sale
*/

const Products = new Schema({
  name: String,
  site: String,
  url: String,
  price: Number,
  sku: String,
  createdAt: { type: Date, default: Date.now },
  status: {
    // 1 - Candidate
    // 2 - Release
    // 3 - Deleted Candidate
    // 4 - Deleted Release
    type: Number,
    default: 1,
  },
  sessionhash: String,
  error: Number,
  showroom: Boolean,
  warning: Number,
  stocks: [
    {
      name: String,
      count: Number,
      status: Number,
      address: String,
    },
  ],
  version: { type: Number, default: 1 },
})

export default mongoose.model("Products", Products)
