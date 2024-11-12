function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

function generateData(days = 10) {
  const products = ["chairman-408", "chairman-505", "chairman-655"]
  const buff = []
  let now = (saveNow = Date.now())
  products.forEach(product => {
    for (let i = 0; i < days; ++i) {
      const createdAt = now
      buff.push({
        product,
        site: "site4",
        price: 9000 + random(0, 30) * 200,
        createdAt,
      })

      buff.push({
        product,
        site: "site8",
        price: 9000 + random(0, 30) * 200,
        createdAt,
      })

      now += 1000 * 3600 * 24
    }
    now = saveNow
  })

  return buff
}
