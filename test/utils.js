
const test = require('tape')

const { makeThenable } = require('../src/utils')

test('makeThenable objects are Promise ducks', async (t) => {

  const target = 'foo'
  const responseObject = {
    result: target,
    jsonrpc: '2.0',
    id: 2512950,
  }

  const customThenable = (obj) => makeThenable(obj, 'result')
  const promiseThenable = (obj) => Promise.resolve(obj.result)

  const customRes = await runThenableTests(customThenable)
  const promiseRes = await runThenableTests(promiseThenable)

  await Promise.all(Object.entries(customRes).map(async ([k, v1]) => {

    const v2 = promiseRes[k]

    if (k === 'funcRes') {
      t.deepEqual(v1, responseObject, 'makeThenable direct return is the target object')
      t.ok(Boolean(v1.then), 'makeThenable direct return has hidden "then" property')
      t.ok(v2 instanceof Promise, 'promiseThenable direct return is a Promise')
      const v2res = await v2
      t.ok(v2res === target, 'promiseThenable direct return resolves to target value')
    } else if (v1 instanceof Promise) {
      t.ok(v2 instanceof Promise, 'value1 instanceof Promise -> value2 instanceof Promise')
      const r1 = await v1
      const r2 = await v2
      t.deepEqual(r1, r2, 'promises resolve to the same values')
    } else {
      t.deepEqual(v1, v2, 'values are equal')
    }
  }))

  const response = customThenable({ ...responseObject })
  const stringResponse = JSON.stringify(response, null, 2)
  t.comment(`serialized thenable response:\n${stringResponse}`)
  t.deepEqual(JSON.parse(stringResponse), response, 'serializing and deserializing preserves response without "then"')

  t.end()

  async function runThenableTests (func) {

    const results = {}

    results.funcRes = func({ ...responseObject })

    await func({ ...responseObject }).then((res) => {
      results.res1then1 = res
    })

    const chainRes = await func({ ...responseObject }).then((res) => {
      results.res2then1 = res
      return res
    })
      .then((res) => {
        results.res2then2 = res
        return res
      })
    results.chainRes = chainRes

    results.asyncRes = await func({ ...responseObject })

    return results
  }
})
