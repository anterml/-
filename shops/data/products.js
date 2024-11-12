const products = []

export const FAST_PRODUCTS = {
  site3: {
    "chairman-402-koza": {
      getApiUrl: ids => `site3/items/?itemsIds=${ids}&format=json`,
      getUrl: id =>
        `site3/mebel-dlya-ofisa/kresla-rukovoditelya/goods-samuraj-id${id}/`,
      id2SkuList: {
        161247: "темно-бежевый",
        156631: "черный",
        161248: "черный плюс",
        156630: "темно-коричневый",
      },
    },
    "chairman-game-15-ekokoza": {
      getApiUrl: ids => `site3/items/?itemsIds=${ids}&format=json`,
      getUrl: id =>
        `site3/mebel-dlya-doma/igrovye-kresla/goods-febris-id${id}/`,
      id2SkuList: {
        167427: "Черный/Красный",
        167428: "Черный/Желтый",
        167429: "Черный/Серый",
        167430: "Черный/Голубой",
      },
    },
    "chairman-game-17-ekokoza": {
      getApiUrl: ids => `site3/items/?itemsIds=${ids}&format=json`,
      getUrl: id => `site3/mebel-dlya-doma/igrovye-kresla/goods-saron-id${id}/`,
      id2SkuList: {
        167441: "Черный/Желтый",
      },
    },
  },
}

function handleProducts(options) {
  const site = "site3"
  const products = []
  if (options[site] && options[site].includes("fast_fetch")) {
    Object.keys(FAST_PRODUCTS[site]).forEach(productName => {
      Object.keys(FAST_PRODUCTS[site][productName].id2SkuList).forEach(id => {
        const sku = FAST_PRODUCTS[site][productName].id2SkuList[id]
        const url = FAST_PRODUCTS[site][productName].getUrl(id)
        products.push([productName, site, sku, url])
      })
    })
  }
}

export const getProducts = options => {
  handleProducts(options)
  products.sort((a, b) => (a[0] >= b[0] ? 1 : -1))
  return products
}
