import replaceSKU from "./replaceSKU.js"

const INSTOCK = {
  outOfStock: 0,
  instock: 1,
  preorder: 2,
  outOfSale: 4,
}

const capitalizeSku = sku =>
  sku
    .split("/")
    .filter(Boolean)
    .map(value => value[0].toUpperCase() + value.substring(1))
    .join("/")

export default {
  site1: async (strategy, name, createdAt) => {
    const { id2SkuList, getApiUrl, getUrl } = strategy
    const apiUrl = getApiUrl(Object.keys(id2SkuList).join(","))
    const response = await fetch(apiUrl)
    const results = await response.json()

    if (!Array.isArray(results)) {
      console.log("!site1", name, "пустой результат")
      return []
    }

    const products = results.map(({ IsAvailable, ItemId, Price }) => {
      const stocks = IsAvailable
        ? [{ name: "n/a", count: -1, status: 1 }]
        : [{ name: "n/a", count: 0, status: 0 }]

      return {
        name,
        site: "site1",
        sku: id2SkuList[ItemId],
        price: Price,
        url: getUrl(ItemId),
        createdAt,
        status: 1,
        stocks,
      }
    })
    return products
  },

  site2: {
    getElement: document => {
      return document
    },
    getPrice: elem => {
      const text = elem.querySelector(
        ".price-item__price .price_no_rub",
      )?.textContent
      return (text || "").replace(/[^\d]+/g, "")
    },
    checkOutOfSales(document) {
      return !!document.querySelector(".out-stock-cart__text")
    },
    getStocks: document => {
      const elem = document.querySelector(".do-it-block__available")
      if (!elem) return

      const text = elem.textContent.toLowerCase()
      if (text.includes("в наличии"))
        return [{ name: "n/a", count: -1, status: 1 }]
      if (text.includes("на заказ"))
        return [{ name: "n/a", count: 0, status: 0 }]
    },

    getFetchOptions() {
      return {
        headers: {
          Cookie:
            '__user_site_version=desktop; _gcl_au=1.1.1577219692.1707745128; rrpvid=873825361528668; tmr_lvid=538130d1f0fcd9f5c7d1caa82e0e1ac4; tmr_lvidTS=1707745128857; _gpVisits={"isFirstVisitDomain":true,"idContainer":"10002601"}; rcuid=65ca1f68014b856547df5408; _ym_uid=1707745129177301552; _ym_d=1707745129; sid=65ca1f68248f87.12616412; PHPSESSID=9akdq5vvndu2gee3p5de1i8sos; _userGUID=0:lsizd4f0:iBmweZ1Ij~Xt1O~xBsdqPs6qSyIhvFcQ; choose_to_stay=1; view_products__kompyuternye_kresla=4; view_products__kresla=4; view_products__kompyuternye_kresla=3; view_products__kresla=3; mindboxDeviceUUID=8ba83b56-488c-4b4d-8c19-6d967781a66f; directCrm-session=%7B%22deviceGuid%22%3A%228ba83b56-488c-4b4d-8c19-6d967781a66f%22%7D; user_region=19; user_city=466; is_prod_site=1690355679; client_id=1253475971; enable_remarketing=0; _cmg_csstMgxc5=1711010616; _comagic_idMgxc5=8346866863.12239462863.1711010615; iwaf_js_cookie_03a471=33e2a368c815bf446a8ff21cd4d6250536ca2d8a60876154a175dc5122e385a6; sessionID=1712510341886.9674260; funnel_type=product; _gid=GA1.2.106992536.1712510342; dSesn=a84b52e6-b34e-4250-e90a-1a4bc619bd5d; _dvs=0:lupsfwpc:reWquuiyfKyACmT8tqpBxAN~OzeBMImN; _ym_isad=1; domain_sid=1U2VzOuw2keUCrZg1GSrx%3A1712510342743; iwaf_fingerprint=0fb754585b6930bac4ea189934f2a115; _cmg_csstZIgQb=1712510345; _comagic_idZIgQb=8421546773.12332610638.1712510341; previous_page=other; start_session=3; digi_uc=W1sidiIsIjE2ODAwNCIsMTcxMjUxMDM0MTk3OF0sWyJ2IiwiMTY3OTk5IiwxNzEyMzAwODM0NTUxXSxbInYiLCIxNjc0NDEiLDE3MTIyNzc2ODQ0MzBdLFsidiIsIjE2ODAwMyIsMTcxMjUxMDk2MzYzNF1d; _ga=GA1.2.1752616243.1707745129; tmr_detect=0%7C1712510966468; _gat_UA-449359-6=1; _ga_0ZMN2NM680=GS1.1.1712510342.18.1.1712511100.60.0.2080985329; _ga_22GT0N29KJ=GS1.1.1712510342.18.1.1712511100.0.0.988782116',
        },
        credentials: "include",
      }
    },
  },

  site3: {
    getElement: doc =>
      doc.querySelector('meta[property="product:pretax_price:amount"'),
    getPrice: elem => elem.getAttribute("content"),
    getStocks: doc => {
      const stockElem = doc.querySelector(
        ".product__property-value--availability",
      )
      if (stockElem) {
        const data = stockElem.textContent
        const count = Number(data.replace(/[^\d]+/g, ""))
        const status = count && count > 0 ? INSTOCK.instock : INSTOCK.outOfStock
        return [{ name: "n/a", count, status }]
      }

      const stock = doc.querySelector(".product__property-name")
      if (stock && stock.textContent.toLowerCase() !== "Ожидается")
        return [{ name: "n/a", count: 0, status: INSTOCK.outOfStock }]
    },
  },

  site4: {
    getElement: document => document.getElementById("tyu_pr"),
    getPrice: elem => elem.getAttribute("content"),
    checkOutOfSales(document) {
      if (!document.querySelectorAll("table.stock th").length) {
        for (const elem of document.querySelectorAll(
          ".wrap > .container > .row b",
        )) {
          if (elem.textContent.toLowerCase() === "модель не поставляется") {
            return true
          }
        }
      }
    },

    getStocks: document => {
      // проверить поля таблицы, чтобы точно идентифицировать склады
      const ths = document.querySelectorAll("table.stock th")

      if (ths.length === 0) {
        return { skip: true }
      }

      const isSPB = ths[3] && ths[3].textContent === "СкладСПб"
      const isMoscow = ths[4] && ths[4].textContent === "СкладМск"
      const isReserve = ths[5] && ths[5].textContent === "СкладРез"

      if (!(isSPB && isMoscow && isReserve))
        return {
          error: "!site4: не получилось определить склады в html разметке",
        }

      // взять элементы с кол-вом продукции на складах
      const tds = document.querySelectorAll(".te.active td")

      // вернуть все по 0 если "ожидается поступление"
      if (
        tds.length === 4 &&
        tds[3].textContent.toLowerCase().indexOf("ожидается поступление") !== -1
      ) {
        return [
          { name: "spb", count: 0, status: INSTOCK.outOfStock },
          { name: "moscow", count: 0, status: INSTOCK.outOfStock },
          { name: "reserve", count: 0, status: INSTOCK.outOfStock },
        ]
      } else {
        // получить данные о кол-вах
        const spbCount =
          tds[3] && Number(tds[3].textContent.replace(/[^\d]+/g, ""))
        const moscowCount =
          tds[4] && Number(tds[4].textContent.replace(/[^\d]+/g, ""))
        const reserveCount =
          tds[5] && Number(tds[5].textContent.replace(/[^\d]+/g, ""))

        // проверить, что кол-ва товара на складах являются числовым значением
        if (
          typeof spbCount === "number" &&
          !Number.isNaN(spbCount) &&
          typeof moscowCount === "number" &&
          !Number.isNaN(moscowCount) &&
          typeof reserveCount === "number" &&
          !Number.isNaN(reserveCount)
        ) {
          return [
            {
              name: "spb",
              count: spbCount,
              status: spbCount ? INSTOCK.instock : INSTOCK.outOfStock,
            },
            {
              name: "moscow",
              count: moscowCount,
              status: moscowCount ? INSTOCK.instock : INSTOCK.outOfStock,
            },
            {
              name: "reserve",
              count: reserveCount,
              status: reserveCount ? INSTOCK.instock : INSTOCK.outOfStock,
            },
          ]
        }
      }
    },
  },

  site5: {
    checkOutOfSales(doc) {
      // снят с производства
      const text = doc.getElementById("short_description_content")
      const isDiscontinued =
        text &&
        text.textContent.toLowerCase().indexOf("снят с производства") !== -1

      // модификация отсутствует
      const stockText = doc.getElementById("availability_value")
      const isNotAvailable =
        stockText &&
        stockText.textContent
          .toLowerCase()
          .indexOf("модификация отсутствует") !== -1

      return isDiscontinued || isNotAvailable
    },
    getElement: doc => doc.getElementById("our_price_display"),
    getPrice: elem => elem.getAttribute("content"),
    // кажется, на всех позициях просто тупо стоит https://schema.org/instock
    getStocks(document) {
      const stockValue = document.querySelector(
        '[itemprop="availability"]',
      )?.href
      return typeof stockValue === "string" &&
        stockValue.toLowerCase() === "https://schema.org/instock"
        ? [{ name: "n/a", count: -1, status: INSTOCK.instock }]
        : [{ name: "n/a", count: 0, status: INSTOCK.outOfStock }]
    },
  },

  site6: {
    getElement: (document, skuList, productName) => {
      const offers = document.querySelectorAll("[itemprop='offers']")

      if (offers.length > 1)
        return console.log("Предложений больше одного, проверить позицию")

      const offerElem = offers[0]
      if (!offerElem) return

      const stockValue = offerElem.querySelector(
        '[itemprop="availability"]',
      )?.href
      const stocks =
        typeof stockValue === "string" &&
        stockValue.toLowerCase() === "http://schema.org/instock"
          ? [{ name: "n/a", count: -1, status: INSTOCK.instock }]
          : [{ name: "n/a", count: 0, status: INSTOCK.outOfStock }]

      const price = offerElem
        .querySelector('[itemprop="price"]')
        ?.getAttribute("content")
      const showroom = !!document.querySelector(
        ".product-detail-gallery .sticker_v_shourume",
      )

      const products = []
      for (const sku of skuList) {
        products.push({ sku, stocks, price, showroom })
      }
      return products
    },
  },

  site7: {
    checkOutOfSales(doc) {
      return !!doc.querySelector(".price-block__price._INACCESSIBLY")
    },

    isInShowroom: doc => !!doc.querySelector(".sticker_est_na_vystavke"),

    getStocks: document => {
      const elem = document.querySelector(".store_view")
      if (!elem) {
        return console.log("Не найден элемент наличия")
      }

      const text = elem.parentNode.textContent.toLowerCase()

      if (text.includes("есть в наличии")) {
        const count = Number(text.replace(/[^\d]+([\d]+).*/, "$1"))
        if (!count)
          return console.log(
            "Не получилось получить численное значение наличия",
          )
        return [{ name: "spb.tc", count, status: INSTOCK.instock }]
      } else if (text.includes("нет в наличии")) {
        return [{ name: "spb.tc", count: 0, status: INSTOCK.outOfStock }]
      } else if (text.includes("заказ")) {
        return [{ name: "spb.tc", count: 0, status: INSTOCK.preorder }]
      } else {
        return console.log("Не могу определить наличие")
      }
    },

    getElement: doc => {
      return doc.querySelectorAll(".product-main")[1]
    },
    getPrice: elem =>
      (elem.querySelector(".price_value").textContent || "").replace(
        /[^\d]+/g,
        "",
      ),
  },

  site8: {
    checkOutOfSales(doc) {
      return !!doc.querySelector(".price-block__price._INACCESSIBLY")
    },
    getElement: doc => doc.querySelector(".price-block__price"),
    getPrice: elem => elem.textContent.replace(/[^\d]+/g, ""),
  },

  site9: {
    checkOutOfSales(doc) {
      // Ошибка на сайте, есть цена и можно заказать товар,
      // но стоит http://schema.org/OutOfStock
      const offerElems = doc.querySelectorAll(
        '[itemtype="http://schema.org/Offer"] [itemprop="price"]',
      )
      for (const elem of offerElems) if (parseInt(elem.content)) return false
      const text = doc.querySelector(".preview_text")
      const outOfSale =
        text &&
        text.textContent
          .toLowerCase()
          .indexOf("товар выведен из ассортимента!") !== -1
      const target = doc.querySelector('[itemprop="availability"]')
      const outOfStock =
        target && target.href === "http://schema.org/OutOfStock"
      return outOfSale || outOfStock
    },

    getStocks(document) {
      const box = document.querySelector(".props_list")
      const trs = Array.from(box.querySelectorAll("tr")).filter(
        elem => !elem.hasAttribute("itemprop"),
      )

      const products = []
      for (let i = 0; i < trs.length; i += 2) {
        const names = trs[i].querySelector("a").title.split(" ")
        const price = trs[i]
          .querySelector(".char_name > div > span")
          .textContent.replace(/[^\d]+/g, "")
        const name = names[names.length - 1]
        const stocks = []
        for (const li of trs[i + 1].querySelectorAll("li")) {
          const [count, city, address] = li.textContent
            .replace(
              /(\d+)\s+шт.\s+\-\s+([^\,]+)\,\s+склад([^\(]+).*/g,
              "$1--$2--$3",
            )
            .split("--")
          stocks.push({
            name: city,
            address: address.trim().replaceAll('"', ""),
            count: Number(count),
          })
        }

        products.push({ name, stocks, price })
      }
      return products
    },
    getElement: (document, skuList, productName) => {
      const site = "site9"
      const box = document.querySelector(".props_list")
      const trs = Array.from(box.querySelectorAll("tr")).filter(
        elem => !elem.hasAttribute("itemprop"),
      )
      const products = []
      for (let i = 0; i < trs.length; i += 2) {
        // обработка sku
        const name = (trs[i].querySelector("a")?.title || "").toLowerCase()
        let sku = capitalizeSku(name.split(" ").pop())
        if (!skuList.includes(sku)) {
          let targetSKU = replaceSKU[site][name]
          if (!targetSKU) {
            targetSKU = replaceSKU[site][sku.toLowerCase()]
            if (!targetSKU) {
              console.error(
                `!${site}. ${productName} Нет replaceSKU для`,
                sku,
                "|",
                name,
              )
              continue
            }
          }

          sku =
            typeof targetSKU === "string"
              ? targetSKU
              : targetSKU[productName] || targetSKU.base
        }

        const targetSkuPos = skuList.indexOf(sku)
        if (targetSkuPos !== -1) skuList.splice(targetSkuPos, 1)

        // получение данных о запасах на складах
        const stocks = []
        for (const li of trs[i + 1].querySelectorAll("li")) {
          const [count, city, address] = li.textContent
            .replace(
              /[^\d]*(\d+)\s+шт.\s+\-\s+([^\,]+)\,\s+склад([^\(]+).*/g,
              "$1--$2--$3",
            )
            .split("--")
          stocks.push({
            name: city,
            address: address.trim().replaceAll('"', ""),
            count: Number(count),
          })
        }

        // получение цены
        const priceElem = trs[i].querySelector(".char_name > div > span")
        const price = priceElem && priceElem.textContent.replace(/[^\d]+/g, "")

        products.push({ sku, stocks, price })
      }

      if (skuList.length) {
        console.error(
          `?${site}. ${productName} Не найдены sku`,
          skuList.join(", "),
        )
      }
      return products
    },
  },

  site10: {
    hasMissingPrice: doc => {
      return !doc.querySelector('[itemprop="availability"]')
    },

    getElement: (doc, skuList, productName) => {
      const basePrice = parseInt(
        doc.getElementById("formated_price")?.getAttribute("content"),
      )
      const elems = doc.querySelectorAll(".color-product img")
      const result = []
      const site = "site10"

      for (const elem of elems) {
        const split = (elem.title || "").split("+")

        // определить sku
        let sku = capitalizeSku((split[0] || "").trim().toLowerCase())

        if (!skuList.includes(sku)) {
          const targetSKU = replaceSKU[site][sku.toLowerCase()]
          if (!targetSKU) {
            console.error(`!${site}. ${productName} Нет replaceSKU для`, sku)
            continue
          }

          sku =
            typeof targetSKU === "string"
              ? targetSKU
              : targetSKU[productName] || targetSKU.base
        }

        const targetSkuPos = skuList.indexOf(sku)
        if (targetSkuPos !== -1) skuList.splice(targetSkuPos, 1)

        // рассчитать цену
        const additionalPrice = parseInt(split[1]) || 0
        const price = additionalPrice
          ? basePrice + parseInt(additionalPrice)
          : basePrice

        const data = { sku, price }

        // определить наличие
        const availability = doc
          .querySelector('[itemprop="availability"]')
          ?.getAttribute("content")
        const availabilityText =
          typeof availability === "string" && availability.toLowerCase()
        if (availabilityText === "http://schema.org/preorder") {
          data.stocks = [{ name: "n/a", count: -1, status: INSTOCK.preorder }]
        } else if (availabilityText === "http://schema.org/instock") {
          data.stocks = [{ name: "n/a", count: -1, status: INSTOCK.instock }]
        }

        result.push(data)
      }

      if (skuList.length) {
        console.error(
          `?${site}. ${productName} Не найдены sku`,
          skuList.join(", "),
        )
      }
      return result
    },
  },

  site11: {
    checkOutOfSales(doc) {
      // снят с производства
      const text = doc.getElementById("short_description_content")
      const isDiscontinued =
        text &&
        text.textContent.toLowerCase().indexOf("снят с производства") !== -1

      // модификация отсутствует
      const stockText = doc.getElementById("availability_value")
      const isNotAvailable =
        stockText &&
        stockText.textContent
          .toLowerCase()
          .indexOf("модификация отсутствует") !== -1

      // нет в наличии
      const outOfStockElem = doc.getElementById("quantity_wanted_p")
      const outOfStock =
        outOfStockElem && outOfStockElem.style.display === "none"
      return isDiscontinued || isNotAvailable || outOfStock
    },
    isInShowroom(document) {
      const re = new RegExp(/^\s*\$\('\#bigpic'\)\.parent\(\)\.parent\(\)/)
      for (const script of document.querySelectorAll("script")) {
        if (script.src) continue

        if (
          re.test(script.textContent) &&
          script.textContent.indexOf("/img/stickers/17/Frame3.png") !== -1
        )
          return true
      }
      return false
    },
    getElement: doc => doc.getElementById("our_price_display"),
    checkMissingPriceBecauseOutOfStocks: doc => {
      const stock = doc.getElementById("availability_value")
      return (
        stock && stock.textContent.toLowerCase().indexOf("нет в наличии") !== -1
      )
    },
    getStocks: doc => {
      const stock = doc.getElementById("availability_value")
      if (!stock) return

      return stock.textContent.toLowerCase().includes("нет в наличии")
        ? [{ name: "n/a", count: 0, status: 0 }]
        : [{ name: "n/a", count: -1, status: 1 }]
    },
    getPrice: elem => elem.getAttribute("content"),
  },

  site12: {
    getElement: document => {
      const offers = document.querySelectorAll("[itemprop='offers']")
      if (offers.length > 1)
        return console.log("Предложений больше одного, проверить позицию")
      return offers[0]
    },
    isInShowroom: doc => {
      const elem = doc.querySelector(".new-product-customer-title")
      return !!elem && elem.textContent.toLowerCase().includes("из шоурума")
    },
    getPrice: elem =>
      elem.querySelector('[itemprop="price"]')?.getAttribute("content"),
    getStocks: document => {
      const stockValue = document.querySelector(
        '[itemprop="availability"]',
      )?.href

      if (typeof stockValue !== "string") return

      return stockValue.toLowerCase() === "http://schema.org/instock"
        ? [{ name: "n/a", count: -1, status: INSTOCK.instock }]
        : [{ name: "n/a", count: 0, status: INSTOCK.outOfStock }]
    },
  },
}
