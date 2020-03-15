'use strict'
const assert = require('assert')
const { it } = require('mocha')
const main = require('../')
const parse = require('./parse')

const test = it

test('basic struct', done => {
  const schema = `
  type Test struct {
    name String
    i Int
  }
  `
  const validate = main(parse(schema))
  const hw = { name: 'hello world', i: 1 }
  validate(hw, 'Test')
  done()
})

test('nullable', done => {
  const schema = `
  type Test struct {
    name nullable String
  }
  `
  const validate = main(parse(schema))
  validate({ name: 'hello world' }, 'Test')
  validate({ name: null }, 'Test')
  done()
})

test('properties w/o schema', done => {
  const schema = `
  type Test struct {
    name String
  }
  `
  const hw = { name: 'hello', test: 'world' }
  const validate = main(parse(schema))
  validate(hw, 'Test')
  done()
})

test('struct in struct', async () => {
  const schema = `
  type A struct {
    b B
  }
  type B struct {
    c C
  }
  type C struct {
    name String
  }
  `
  const hw = { b: { c: { name: 'hello' } } }
  const validate = main(parse(schema))
  validate(hw, 'A')
})

test('struct w/ rename', async () => {
  const schema = `
  type R struct {
    hello String (rename "world")
  }
  `
  const validate = main(parse(schema))
  let threw = true
  try {
    validate({ hello: 'world' }, 'R')
    threw = false
  } catch (e) {
    if (e.message !== '"world" is undefined') throw e
  }
  assert.ok(threw)
  validate({ world: 'hello' }, 'R')
})
