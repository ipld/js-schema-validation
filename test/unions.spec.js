'use strict'
const { it } = require('mocha')
const main = require('../')
const parse = require('./parse')

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
