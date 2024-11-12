import express from 'express'
import bodyParser from 'body-parser'
import shopRoutes from './shops/routes.js'
import path from 'path'
import './db/connect.js'

const __dirname = path.resolve()
const app = express()

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json({ limit: '50mb' }))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html')
})

app.get('/candidates', (req, res) => {
  res.sendFile(__dirname + '/public/candidates.html')
})

app.get('/releases', (req, res) => {
  res.sendFile(__dirname + '/public/releases.html')
})

app.get('/graphs', (req, res) => {
  res.sendFile(__dirname + '/public/graphs/index.html')
})

app.use('/shop', shopRoutes)

app.listen(3000, () => {
  console.log('listening on *:3000')
})