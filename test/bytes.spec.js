'use strict'
const { it } = require('mocha')
const main = require('../')
const parse = require('./parse')
const bytes = require('bytesish')

const test = it

test('read bytes', async () => {
  const schema = `
  type TestBytes bytes
  `
  const validate = main(parse(schema))
  validate(bytes.native('asdf'), 'TestBytes')
})
