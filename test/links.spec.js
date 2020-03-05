'use strict'
const { it } = require('mocha')
const main = require('../')
const parse = require('./parse')
const Block = require('@ipld/block')

const test = it

test('basic struct', async () => {
  const schema = `
  type Test struct {
    b &Bytes
  }
  `
  const validate = main(parse(schema))
  const b = Block.encoder(Buffer.from('asdf'), 'raw')
  const origin = { b: await b.cid() }
  validate(origin, 'Test')
})

test('link in map', async () => {
  const schema = `
  type TestInt int
  type TestMap {String:&TestInt}
  `
  const validate = main(parse(schema))
  const intBlock = Block.encoder(12, 'dag-cbor')
  validate({ test: await intBlock.cid() }, 'TestMap')
})

test('link resolve', async () => {
  const schema = `
  type L &Int
  `
  const validate = main(parse(schema))
  const intBlock = Block.encoder(12, 'dag-cbor')
  validate(await intBlock.cid(), 'L')
})

test('link without expected type', async () => {
  const schema = `
  type Test struct {
    b Link
  }
  `
  const validate = main(parse(schema))
  const b = Block.encoder(Buffer.from('asdf'), 'raw')
  const origin = { b: await b.cid() }
  validate(origin, 'Test')
})
