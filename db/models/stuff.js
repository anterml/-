import mongoose from "mongoose"

export default mongoose.model("Stuff", {
  name: String,
  data: {},
})
