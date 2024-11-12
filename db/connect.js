import mongoose from "mongoose"

const DBName = "your-db-name"

async function main() {
  try {
    console.log("trying to connect to DB")
    await mongoose.connect(`mongodb://127.0.0.1:27017/${DBName}`)
    console.log("connection ok")
  } catch (e) {
    console.log("Cannot connection to mongodb")
  }
}

main().catch(err => console.log(err))

export default {}
