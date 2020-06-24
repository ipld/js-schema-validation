/* global it */
import main from '../index.js'
import parse from './parse.js'
import Block from '@ipld/block/defaults.js'
import { fromString } from 'multiformats/bytes.js'

const test = it

test('basic keyed union', done => {
  const schema = `
  type Test union {
    | String "name"
    | String "alt"
  } representation keyed
  `
  const validate = main(parse(schema))
  const hw = { name: 'hello world' }
  validate(hw, 'Test')
  done()
})

test('test path get', async () => {
  const schema = `
  type Test union {
    | String "name"
    | String "alt"
    | Map "map"
  } representation keyed
  `
  const validate = main(parse(schema))
  const hw = { name: 'hello world' }
  validate(hw, 'Test')
  validate({ map: { x: hw } }, 'Test')
})

test('kinded union', async () => {
  const schema = `
  type MyMap map
  type MyList list
  type MyNull null
  type MyString string
  type MyInt int
  type MyFloat float
  type MyBytes bytes
  type MyLink link
  type Test union {
    | MyMap map
    | MyList list
    | MyString string
    | MyInt int
    | MyFloat float
    | MyBytes bytes
    | MyLink link
    | MyNull null
  } representation kinded
  `
  const validate = main(parse(schema))
  const t = obj => validate(obj, 'Test')
  t(null)
  t({})
  t([])
  t('str')
  t(1)
  t(0)
  t(2.9)
  t(await Block.encoder({}, 'dag-cbor').cid())
  t(fromString('asdf'))
})
