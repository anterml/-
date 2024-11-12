import mongoose from "mongoose"
import playwright from "playwright"
import jsdom from "jsdom"
import fs from "fs"
import express from "express"
import { getProducts, FAST_PRODUCTS } from "./data/products.js"
import siteStrategy from "./data/siteStrategy.js"
import badProducts from "./data/badProductsOnSite.js"
import productDb from "../db/models/products.js"

const { JSDOM } = jsdom

const router = express.Router()
const createdAt = new Date()

const PRODUCT_STATUS = {
  candidate: 1,
  release: 2,
}

const OPTIONS = {
  "yoursite.ru": ["fast_fetch"],
}

const sitesWithoutHTTPS = []

const WARNING = {
  outOfSale: 1,
  code404: 2,
  missingPrice: 4,
}

const ERRORS = {
  badPrice: 1,
  noProductElem: 2,
  badStocks: 3,
  missingPrice: 4,
}

const sleepTime = random(14, 15) * 1000
const sleep = time => new Promise(res => setTimeout(res, time))

const random = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

router.get("/api/last-update", async (req, res) => {
  try {
    const promises = [
      productDb.findOne({ status: 1 }).sort({ createdAt: -1 }),
      productDb.findOne({ status: 2 }).sort({ createdAt: -1 }),
    ]

    const [candidate, release] = await Promise.all(promises)

    return res.json({
      candidate,
      release,
    })
  } catch {
    return res.json({})
  }
})

router.get("/api/products/:status", async (req, res) => {
  const status = PRODUCT_STATUS[req.params.status]

  if (!status) {
    res.status(400)
    return res.end()
  }

  try {
    const data = await productDb.find({ status })
    return res.json(data)
  } catch (e) {
    res.status(400)
    return res.send("Не получилось найти кандидатов")
  }
})

router.delete("/duplicate-candidates", async (_, res) => {
  const products = []
  const duplicate = []

  try {
    const data = await productDb.find({ status: PRODUCT_STATUS.candidate })
    data.forEach(({ _id, name, site, sku }) => {
      const value = name + "_" + site + "_" + sku
      if (products.includes(value)) duplicate.push({ _id, value })
      else products.push(value)
    })

    await productDb.deleteMany({ _id: duplicate.map(item => item._id) })
  } catch {
    res.status(400)
    return res.send("Не получилось удалить дубликаты кандидатов")
  }

  return res.send(duplicate.map(item => item._id).join("\n"))
})

router.delete("/remove-all-candidates", async (_, res) => {
  try {
    await productDb.deleteMany({ status: PRODUCT_STATUS.candidate })
    return res.send("Все кандидаты удалены")
  } catch {
    res.status(400)
    return res.send("Не получилось удалить кандидатов")
  }
})

router.put("/release", async (_, res) => {
  try {
    await productDb.updateMany({ status: 1 }, { $set: { status: 2 } })
    return res.send("Кандитаты переведены в релиз")
  } catch {
    res.status(400)
    return res.send("Не получилось перевести кандидатов в релиз")
  }
})

router.delete("/selected-candidates", async (req, res) => {
  try {
    const { site, error } = req.body
    const match = { status: PRODUCT_STATUS.candidate }

    if (site) match.site = site
    if (error) match.error = { $gt: 1 }

    await productDb.deleteMany(match)
    return res.send("Кандидаты успешно удалены")
  } catch {
    res.status(400)
    return res.send("Не получилось удалить кандидатов")
  }
})

router.get("/fresh", async (req, res) => {
  const { type } = req.query
  const logs = []
  const bulk = []
  const badProductIds = []
  let data

  try {
    data = JSON.parse(req.query.data)
  } catch {
    res.status(400)
    return res.send("Не получилось распарсить req.query")
  }

  if (!data.sites.length) {
    throw new Error("Не выбрано ниодного сайта")
  }
  if (!data.products.length) {
    throw new Error("Не выбрано ниодного продукта")
  }

  let prevCandidates
  try {
    prevCandidates = await productDb.find({ status: PRODUCT_STATUS.candidate })
  } catch {
    console.log(
      "Не получилось получить инфу о кандидатах при обновлении позиций",
    )
  }

  console.log("\n")

  if (!data.products.length || !data.sites.length) {
    res.status(400)
    return res.end(`Не указан ни один продукт или сайт ${site}`)
  }

  for (const site of data.sites) {
    // выявить ошибки (если есть) на отсутствие стратегии
    if (!siteStrategy[site]) {
      res.status(400)
      return res.end(`Не найдена стратегия для сайта ${site}`)
    }

    // выявить ошибки (если есть) на быстрые статегии
    const fastFetch = OPTIONS[site]?.includes("fast_fetch")
    if (fastFetch && !siteStrategy[`fast:${site}`]) {
      res.status(400)
      return res.end(`Фаст стратегия указана, но не найдена для сайта ${site}`)
    }
  }

  const PRODUCTS = getProducts(OPTIONS)
  data.products.reverse()

  for (const product of data.products) {
    for (const site of data.sites) {
      const fastFetch = OPTIONS[site]?.includes("fast_fetch")

      if (fastFetch) {
        const fastStrategy = siteStrategy[`fast:${site}`]
        const target = FAST_PRODUCTS[site][product]
        if (!target) {
          console.log(`!${site}: FAST_PRODUCTS не найден`, product)
          logs.push(`- ${site} - ${product}`)
          logs.push("- FAST_PRODUCTS не найден\n")
        }

        const products = await fastStrategy(target, product, createdAt)
        products.forEach(product => {
          const { site, name, sku, price, stocks, url } = product
          console.log(site, name, sku, price, stocks)
          logs.push(
            `+ ${site} - ${product} - ${sku} - ${price} - stockslength:${stocks.length} - ${url}`,
          )
        })

        continue
      }

      const strategy = siteStrategy[site]

      if (!strategy) {
        const errorMessage = "стратегия не найдена"
        logs.push(`- ${site} - ${product} - ${sku}`, `- ${errorMessage}\n`)
        console.log(`!${site}:`, errorMessage, strategy)
        continue
      }

      const targets = PRODUCTS.filter(
        target => target[0] === product && target[1] === site,
      )
      // продукт не найден
      if (!targets.length) {
        console.log("Отсутствует", site, product)
        continue
      }

      for (const [product, site, sku, url] of targets) {
        // пропустить продукт если страница продукта является "битой"
        const badProduct =
          badProducts && badProducts[site] && badProducts[site][product]
        if (badProduct) {
          logs.push(`- ${site} - ${product} - ${sku}`)
          logs.push("- игнорирую, битая страница\n")
          console.log(`!${site}`, product, sku, "ошибка на сайте:", badProduct)
          continue
        }

        // пропустить продукт если он уже был обработан (т.е. находится в статусе candidate)
        if (type === "load") {
          const candidates = prevCandidates.filter(candidate => {
            if (candidate.name !== product || candidate.site !== site)
              return false

            const skuList = sku.split("|")
            return skuList.includes(candidate.sku)
          })

          if (candidates.length) {
            const badCandidates = candidates.filter(
              candidate => !!candidate.error,
            )
            if (badCandidates.length) {
              badCandidates.forEach(({ _id }) => badProductIds.push(_id))
            }

            const goodCandidate = candidates.find(candidate => !candidate.error)
            if (goodCandidate) {
              logs.push(`- ${site} - ${product} - ${sku} - ${url}`)
              logs.push("- пропустить кандидаты\n")
              continue
            }
          }
        }

        const skuList = sku.split("|")
        let dom
        try {
          process.env["NODE_TLS_REJECT_UNAUTHORIZED"] =
            sitesWithoutHTTPS.includes(site) ? 0 : 1
          const fetchOptions = strategy.getFetchOptions
            ? strategy.getFetchOptions()
            : {}
          const response = await fetch(url, fetchOptions)

          if (response.status === 404) {
            logs.push(`- ${site} - ${product} - ${sku} - ${url}`)
            logs.push("- 404")
            console.log("!404", site, product, sku, url)
            sku.split("|").forEach(value => {
              bulk.push({
                name: product,
                site,
                url,
                sku: value,
                createdAt,
                warning: WARNING.code404,
              })
            })
            continue
          }

          const res = await response.text()
          dom = new JSDOM(res)
        } catch (e) {
          const errorName = "ERR_NON_2XX_3XX_RESPONSE"
          if (e.code === errorName) {
            logs.push(
              `- ${site} - ${product} - ${sku} - ${url}`,
              `- ${errorName}`,
            )
            console.log("!", errorName, url)
            sku.split("|").forEach(value => {
              bulk.push({
                name: product,
                site,
                url,
                sku: value,
                createdAt,
                warning: WARNING.code404,
              })
            })
          } else {
            logs.push(`- ${site} - ${product} - ${sku} - ${url}`)
            const errorMessage = "Не получилось подключится по url"
            logs.push(`- ${errorMessage}`)
            console.log(errorMessage, url)
          }
          continue
        }

        if (
          "hasMissingPrice" in strategy &&
          strategy.hasMissingPrice(dom.window.document)
        ) {
          const errorMessage = "нет цены на сайте производителя"
          logs.push(`+ ${site} - ${product} - ${sku} - ${url}`, `* `)
          logs.push(`* ${errorMessage}\n`)
          console.log("!", site, product, sku, errorMessage)
          const stocks = [{ name: "n/a", count: 0, status: 0 }]
          sku.split("|").forEach(value => {
            bulk.push({
              name: product,
              site,
              url,
              sku: value,
              price: 0,
              stocks,
              createdAt,
              warning: WARNING.missingPrice,
            })
          })
          continue
        }

        // Проверить, если вышел из продажи
        if (
          "checkOutOfSales" in strategy &&
          strategy.checkOutOfSales(dom.window.document)
        ) {
          const errorMessage = "вышел из продажи"
          logs.push(
            `+ ${site} - ${product} - ${sku} - ${url}`,
            `* ${errorMessage}\n`,
          )
          console.log("?", site, product, sku, errorMessage)
          sku.split("|").forEach(value => {
            bulk.push({
              name: product,
              site,
              url,
              sku: value,
              createdAt,
              warning: WARNING.outOfSale,
            })
          })
          continue
        }

        const elem = strategy.getElement(dom.window.document, skuList, product)

        // обработать если элемент продукта не найден
        if (!elem || (Array.isArray(elem) && elem.length === 0)) {
          // не найден, потому что отсутствует цена из-за "нет в наличии"
          if (
            "checkMissingPriceBecauseOutOfStocks" in strategy &&
            strategy.checkMissingPriceBecauseOutOfStocks(dom.window.document)
          ) {
            const errorMessage = "нет цены, потому что нет в наличии"
            logs.push(
              `+ ${site} - ${product} - ${sku} - ${url}`,
              `* ${errorMessage}\n`,
            )
            console.log(
              "!",
              site,
              product,
              sku,
              errorMessage,
              sku.split("|").length,
            )
            const stocks = [{ name: "n/a", count: 0, status: 0 }]
            sku.split("|").forEach(value => {
              bulk.push({
                name: product,
                site,
                url,
                sku: value,
                price: 0,
                stocks,
                createdAt,
                error: ERRORS.missingPrice,
              })
            })
          }
          // не найден сам элемент
          else {
            const errorMessage = "не найден элемент продукта"
            logs.push(
              `+ ${site} - ${product} - ${sku} - ${url}`,
              `- ${errorMessage}\n`,
            )
            console.log("!", site, product, errorMessage)
            sku.split("|").forEach(value => {
              bulk.push({
                name: product,
                site,
                url,
                sku: value,
                createdAt,
                error: ERRORS.noProductElem,
              })
            })
          }
          continue
        }

        if (Array.isArray(elem)) {
          for (const item of elem) {
            const price = parseInt(item.price)
            if (
              typeof price !== "number" ||
              Number.isNaN(price) ||
              price <= 0
            ) {
              const errorMessage = "плохая цена продукта"
              logs.push(
                `+ ${site} - ${product} - ${item.sku} - ${price} - ${url}`,
                `- ${errorMessage}\n`,
              )
              console.log("!", site, product, item.sku, errorMessage, price)
              bulk.push({
                name: product,
                site,
                url,
                sku: item.sku,
                createdAt,
                error: ERRORS.badPrice,
              })
              continue
            }
            const showroom = !!item.showroom
            bulk.push({
              name: product,
              site,
              url,
              sku: item.sku,
              price,
              createdAt,
              showroom,
            })
            logs.push(
              `+ ${site} - ${product} - ${item.sku} - ${price} - item.stockslength:${item.stocks.length} - showroom:${showroom} - ${url}`,
            )
            console.log(
              site,
              product,
              item.sku,
              price,
              item.stocks,
              `showroom:${showroom}`,
            )
          }
        } else {
          const data = { name: product, site, url, sku, createdAt }
          const price = parseInt(strategy.getPrice(elem))
          if (typeof price !== "number" || Number.isNaN(price) || price <= 0) {
            const errorMessage = "плохая цена продукта"
            console.log("!", site, product, sku, price, errorMessage)
            logs.push(
              `+ ${site} - ${product} - ${sku} - ${price} - ${url}`,
              `- ${errorMessage}\n`,
            )
            data.error = ERRORS.badPrice
            bulk.push(data)
            continue
          }

          data.price = price
          data.showroom =
            "isInShowroom" in strategy &&
            strategy.isInShowroom(dom.window.document)

          if ("getStocks" in strategy) {
            const stocks = strategy.getStocks(dom.window.document, elem)
            // найдены склады
            if (Array.isArray(stocks)) {
              data.stocks = stocks
              console.log(
                site,
                product,
                sku,
                price,
                stocks,
                `showroom=${data.showroom}`,
              )
              logs.push(
                `+ ${site} - ${product} - ${sku} - ${price} - item.stockslength:${stocks.length} - showroom:${data.showroom} - ${url}`,
              )
            }
            // не найдены склады, потому что не указаны на сайте (не ошибка)
            else if (stocks && stocks.skip) {
              const errorMessage = "пропущены данные по складам"
              console.log("?", site, product, sku, price, errorMessage)
              logs.push(
                `+ ${site} - ${product} - ${sku} - ${price} - item.stockslength:${stocks.length} - showroom:${data.showroom} - ${url}`,
                `* ${errorMessage}\n`,
              )
            } else if (!stocks || stocks.error) {
              const error = stocks
                ? stocks.error
                : "не получается найти данные по складам"
              console.log("!", site, product, sku, price, error)
              logs.push(`- ${error}\n`)
            }
          } else {
            console.log(site, product, sku, price, `showroom=${data.showroom}`)
          }

          logs.push(
            `+ ${site} - ${product} - ${sku} - ${price} - item.stockslength:${
              data.stocks ? data.stocks.length : "n/a"
            } - showroom:${data.showroom} - ${url}`,
          )
          if (data.error) logs.push(`- ${data.error}\n`)
          bulk.push(data)
        }
      }
    }
    if (sleepTime) {
      await sleep(sleepTime)
    }
  }

  if (type === "load" && bulk.length) {
    try {
      await productDb.insertMany(bulk)
      const msg = `Новые данные в кол-ве ${bulk.length} записаны в БД`
      console.log(msg)
      logs.push(msg)
    } catch (e) {
      const errorMsg = "Не удалось записать данные в БД"
      console.log(errorMsg, e)
      logs.push(errorMsg)
    }
  }

  if (type === "load" && badProductIds.length) {
    logs.push("Попытка удалить дубликаты")
    try {
      await productDb.deleteMany({ _id: badProductIds })
      const msg = `Плохие позиции в кол-ве ${badProductIds.length} удалены из БД`
      console.log(msg)
      logs.push(msg)
    } catch (e) {
      const errorMsg = "Не удалось удалить дубликаты из БД"
      console.log(errorMsg, e)
      logs.push(errorMsg)
    }
  }

  console.log("Всего добавлено", bulk.length)
  writeDataToFile(logs, createdAt)
  res.send("Готово")
})

function writeDataToFile(logs, date) {
  const folderName = `logs/${date.toLocaleDateString()}`
  const fileName = `${date.toLocaleTimeString().replace(/\:/g, "_")}.txt`

  try {
    if (!fs.existsSync(folderName)) fs.mkdirSync(folderName)

    fs.writeFile(`${folderName}/${fileName}`, logs.join("\n"), err => {
      if (err) {
        console.error(err)
      }
    })
  } catch (err) {
    console.error(err)
  }
}

router.get("/api/align-candidate-date-by-min", async (req, res) => {
  try {
    const data = await productDb.find({ status: PRODUCT_STATUS.candidate })
    let minDate = new Date()

    data.forEach(product => {
      if (product.createdAt < minDate) minDate = product.createdAt
    })

    const ids = data.reduce((acc, product) => {
      if (product.createdAt > minDate) {
        acc.push(product._id)
      }
      return acc
    }, [])

    let text
    if (ids.length) {
      text = `Изменяю дату на ${minDate.toISOString()} у ${ids}`
      await productDb.updateMany({ _id: ids }, { $set: { createdAt: minDate } })
    } else {
      text = "У всех даты одинаковые"
    }

    return res.send(text)
  } catch (e) {
    res.status(400)
    return res.send("Не получилось изменить даты")
  }
})

router.delete("/api/product/:id", async (req, res) => {
  const { id } = req.params
  try {
    const result = await productDb.deleteOne({ _id: id })
    if (result.deletedCount) return res.send("Позиция успешно удалена")
  } catch (e) {
    res.status(404)
    return res.send("Позиция не найдена")
  }

  res.status(500)
  res.send("При удалении позиции что-то пошло не так")
})

router.get("/api/change-date", async (req, res) => {
  const { from, to } = req.query
  if (typeof from !== "string" && typeof to !== "string") {
    res.status(400)
    return res.end("Переданы неправильные даты")
  }
  try {
    await productDb.updateMany(
      {
        status: PRODUCT_STATUS.candidate,
        createdAt: new Date(from),
      },
      { $set: { createdAt: new Date(to) } },
    )
    return res.end("ok")
  } catch {
    res.status(404)
    return res.send("Позиция не найдена")
  }
})

router.get("/api/check-price", async (req, res) => {
  const { url } = req.query
  const browserType = playwright.chromium
  const browser = await browserType.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(url)

  const content = await page.evaluate(() => {
    const elem = document.getElementById("our_price_display")

    if (!elem) return console.log("Элемент с ценой не найден")

    return elem.textContent
  })

  await browser.close()
  res.end()
})

router.get("/api/lowercase/:site", async (req, res) => {
  const { site } = req.params

  if (!site) return res.end("Не указан сайт")

  const match = site !== "all" ? { site } : {}

  try {
    const products = await productDb.find(match)
    const bulk = productDb.collection.initializeUnorderedBulkOp()
    let updateCounter = 0
    for (let { _id, sku } of products) {
      const newSku = sku
        .split("/")
        .map(value => value[0].toUpperCase() + value.substring(1).toLowerCase())
        .join("/")

      if (newSku !== sku) {
        updateCounter += 1
        bulk.find({ _id }).update({ $set: { sku: newSku } })
      }
    }

    if (updateCounter) {
      await bulk.execute()
      res.end("Обновлено")
    } else {
      res.end("Нет необходимости обновлять.")
    }
  } catch (e) {
    res.status(404)
    res.send(e)
  }
})

router.get("/api/joinsku", async (req, res) => {
  try {
    const removeProducts = []
    const insertProducts = []
    const products = await productDb.find().lean()

    for (let product of products) {
      const { _id, sku } = product
      const skuList = sku.split("|")

      if (skuList.length > 1) {
        removeProducts.push(_id)
        skuList.forEach(sku => {
          insertProducts.push({
            ...product,
            _id: new mongoose.Types.ObjectId(),
            sku,
          })
        })
      }
    }

    if (removeProducts) {
      await productDb.deleteMany({ _id: removeProducts })
      await productDb.insertMany(insertProducts)
    }

    res.json({})
  } catch (e) {
    res.status(404)
    res.send(e)
  }
})

router.get("/api/aggregate", async (req, res) => {
  try {
    const products = await productDb.aggregate([
      {
        $group: {
          _id: "$createdAt",
          count: { $sum: 1 },
        },
      },
    ])

    const buff = {}
    products.forEach(({ _id }) => {
      const [data, rest] = _id.toISOString().split("T")
      if (!buff[data]) buff[data] = []
      if (!buff[data].includes(rest)) buff[data].push(rest)
    })

    res.send(JSON.stringify(buff, null, 2))
  } catch (e) {
    res.status(404)
    res.send(e)
  }
})

export default router
