/* global it */
import main from '@ipld/schema-validation'
import parse from './parse.js'
import Block from '@ipld/block/defaults'
import { create } from 'multiformats'

const { fromString } = create().bytes

const test = it

test('basic struct', async () => {
  const schema = `
  type Test struct {
    b &Bytes
  }
  `
  const validate = main(parse(schema))
  const b = Block.encoder(fromString('asdf'), 'raw')
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
  const b = Block.encoder(fromString('asdf'), 'raw')
  const origin = { b: await b.cid() }
  validate(origin, 'Test')
})

test('link in union', async () => {
  const schema = `
  type Blah string
  type Test union {
    | &Blah "t"
  } representation keyed
  `
  const b = Block.encoder({ hello: 'world' }, 'dag-cbor')
  const validate = main(parse(schema))
  validate({ t: await b.cid() }, 'Test')
})

test('link in struct', async () => {
  const schema = `
  type Blah string
  type Test struct{
    t &Blah
  }
  `
  const b = Block.encoder({ hello: 'world' }, 'dag-cbor')
  const validate = main(parse(schema))
  validate({ t: await b.cid() }, 'Test')
})
